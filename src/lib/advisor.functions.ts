import { createServerFn } from "@tanstack/react-start";

type AdvisorMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

const SYSTEM_PROMPT = `You are InkSimulator's AI Tattoo Advisor — an experienced tattoo advisor with a feel for style, placement, size, and skin anatomy.

Give short, concrete advice (max 4-5 sentences per answer) about:
- Placement based on anatomy, pain, and how the motif flows with the body's lines
- Size in cm based on level of detail and placement
- Style (blackwork, fine line, traditional, realism, geometric, etc.)
- Color vs. black
- Aging tips and aftercare

When the user sends an image: analyze style, quality, composition, and suggest matching motifs, placement, or complementary design.

Always answer in English. Use markdown lists sparingly. Be warm, direct, and inspiring — like a trusted friend with 20 years of experience with the needle.`;

export const askAdvisor = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      history: Array<{ role: "user" | "assistant"; text: string; imageDataUrl?: string }>;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ reply: string } | { error: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { error: "The AI service is not configured." };

    const messages: AdvisorMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...data.history.map((m) => {
        if (m.imageDataUrl && m.role === "user") {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.text || "Analyze this tattoo / reference." },
              { type: "image_url", image_url: { url: m.imageDataUrl } },
            ],
          } satisfies AdvisorMessage;
        }
        return { role: m.role, content: m.text } satisfies AdvisorMessage;
      }),
    ];

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages,
        }),
      });
      if (res.status === 429)
        return { error: "Too many questions right now — try again in a moment." };
      if (res.status === 402)
        return { error: "AI credits are used up. Top up in the workspace settings." };
      if (!res.ok) return { error: `AI error (${res.status}). Try again.` };
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!reply) return { error: "Got no response — try again." };
      return { reply };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Network error" };
    }
  });
