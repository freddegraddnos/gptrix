export type TimeSuggestion = {
  found: boolean;
  startsAt: string | null; // "YYYY-MM-DDTHH:mm" in studio local time
  durationMinutes: number | null;
  label: string | null;
  confidence: number;
};

const EMPTY: TimeSuggestion = { found: false, startsAt: null, durationMinutes: null, label: null, confidence: 0 };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    found: { type: "boolean" },
    startsAt: { type: ["string", "null"] },
    durationMinutes: { type: ["integer", "null"] },
    label: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
  required: ["found", "startsAt", "durationMinutes", "label", "confidence"],
} as const;

/**
 * Reads one chat message and reports a concrete appointment time when the
 * text contains one. Streaming is required on the Responses API.
 */
export async function extractTimeFromText(text: string, timeZone = "Europe/Stockholm"): Promise<TimeSuggestion> {
  const trimmed = text.trim();
  if (trimmed.length < 4) return EMPTY;
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return EMPTY;

  const today = new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short" }).format(new Date());
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      reasoning: { effort: "low" },
      instructions:
        `You extract tattoo appointment times from chat messages. Today is ${today} in ${timeZone}. ` +
        "Only report a time when the message proposes or accepts a specific appointment moment. " +
        "Return startsAt as local time 'YYYY-MM-DDTHH:mm'. Use null when nothing concrete is proposed. " +
        "durationMinutes only when the message states a length. label is a short human phrase like 'Saturday 14 March, 14:00'.",
      input: [{ role: "user", content: [{ type: "input_text", text: trimmed.slice(0, 2000) }] }],
      text: { format: { type: "json_schema", name: "time_suggestion", strict: true, schema: SCHEMA } },
    }),
  });

  if (!res.ok || !res.body) {
    console.error("[aiTime] gateway error", res.status, await res.text().catch(() => ""));
    return EMPTY;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const event = JSON.parse(raw) as { type?: string; delta?: string };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") out += event.delta;
      } catch {
        // partial event, ignore
      }
    }
  }

  try {
    const parsed = JSON.parse(out) as TimeSuggestion;
    if (!parsed.found || !parsed.startsAt) return EMPTY;
    return {
      found: true,
      startsAt: parsed.startsAt,
      durationMinutes: parsed.durationMinutes ?? null,
      label: parsed.label ?? parsed.startsAt,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return EMPTY;
  }
}
