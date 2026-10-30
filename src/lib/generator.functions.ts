import { createServerFn } from "@tanstack/react-start";

export type GeneratorInput = {
  style: string;
  bodyPart: string;
  prompt: string;
  referenceDataUrls: string[]; // data:image/...;base64,...
  variations?: number; // default 3
};

export type GeneratorResult =
  | { images: string[] } // data URLs
  | { error: string };

const STYLE_HINTS: Record<string, string> = {
  blackwork: "bold black ink, high contrast, solid black fills",
  fineline: "delicate fine-line tattoo, thin single-needle lines, minimalist",
  traditional: "american traditional tattoo, bold outlines, limited palette",
  realism: "photorealistic tattoo shading, detailed skin-tone friendly gradients",
  watercolor: "watercolor tattoo, soft washes of color, no outlines",
  geometric: "geometric tattoo, sacred geometry, precise linework",
  japanese: "japanese irezumi style, wind bars, bold outlines, traditional palette",
  neotraditional: "neo-traditional tattoo, refined lines, rich palette",
  dotwork: "dotwork tattoo, stippling, high contrast",
  tribal: "tribal tattoo, bold black shapes, flowing forms",
};

type OneResult = { url: string } | { error: string; status?: number };

async function generateOne(
  apiKey: string,
  fullPrompt: string,
  referenceDataUrls: string[],
  attempt = 0,
): Promise<OneResult> {
  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: fullPrompt }];
  for (const url of referenceDataUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }

  if (res.status === 429) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      return generateOne(apiKey, fullPrompt, referenceDataUrls, attempt + 1);
    }
    return { error: "Too many requests right now — try again in a moment.", status: 429 };
  }
  if (res.status === 402)
    return { error: "AI credits are used up. Top up in the workspace settings.", status: 402 };
  if (!res.ok) {
    if (res.status >= 500 && attempt < 1) {
      await new Promise((r) => setTimeout(r, 800));
      return generateOne(apiKey, fullPrompt, referenceDataUrls, attempt + 1);
    }
    return { error: `AI error (${res.status}). Try again.`, status: res.status };
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
  };
  const b64 = json.data?.[0]?.b64_json;
  if (b64) return { url: `data:image/png;base64,${b64}` };
  const direct = json.data?.[0]?.url ?? json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (direct) return { url: direct };
  return { error: "The model did not return an image." };
}

export const generateTattoo = createServerFn({ method: "POST" })
  .inputValidator((data: GeneratorInput) => data)
  .handler(async ({ data }): Promise<GeneratorResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { error: "The AI service is not configured." };

    const styleHint = STYLE_HINTS[data.style] ?? data.style;
    const bodyHint = data.bodyPart ? ` intended for placement on the ${data.bodyPart}` : "";
    const refHint = data.referenceDataUrls.length
      ? " Use the provided reference image(s) as the primary visual starting point — keep the recognisable subject but reinterpret it in the requested tattoo style."
      : "";

    const base = `A single high-quality tattoo design in ${styleHint} style${bodyHint}. ${data.prompt}. Isolated tattoo artwork on a perfectly flat pure white (#FFFFFF) background with no gradient, no shadow, no paper texture, no frame and no border. Centered, no skin, no body, no mockup, no text, no watermark, crisp clean vector-like linework with fully opaque black ink, print-ready flash sheet quality suitable for background removal.${refHint}`;

    const variations = Math.min(Math.max(data.variations ?? 3, 1), 4);
    const seedHints = [
      "Version A — balanced classic composition.",
      "Version B — more dramatic and dynamic composition, slightly different angle.",
      "Version C — more ornamental with added decorative elements around the subject.",
      "Version D — minimal and refined variation, less detail, more negative space.",
    ];

    const prompts = Array.from({ length: variations }, (_, i) => `${base} ${seedHints[i]}`);

    try {
      const results = await Promise.all(
        prompts.map((p) => generateOne(apiKey, p, data.referenceDataUrls)),
      );
      const images = results
        .filter((r): r is { url: string } => "url" in r)
        .map((r) => r.url);
      if (!images.length) {
        const firstErr = results.find((r): r is { error: string; status?: number } => "error" in r);
        return { error: firstErr?.error ?? "Could not generate images. Try again." };
      }
      return { images };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Network error" };
    }
  });

