import { createServerFn } from "@tanstack/react-start";

const PROMPT = `Trace this image into a tattoo stencil. Trace faithfully — do NOT redesign, restyle, add, remove or reinterpret anything. Keep the exact shapes, silhouette, positions and proportions of the original. Output clean, continuous, solid pure black (#000000) linework only on a pure white (#FFFFFF) background. No gray, no shading, no halftone, no dots, no texture, no text, no border. Same framing and aspect ratio as the input.`;

export type AiStencilResult = { url: string } | { error: string };

export const aiCleanLines = createServerFn({ method: "POST" })
  .inputValidator((data: { imageDataUrl: string }) => {
    if (typeof data?.imageDataUrl !== "string" || !data.imageDataUrl.startsWith("data:image/"))
      throw new Error("Invalid image");
    if (data.imageDataUrl.length > 8_000_000) throw new Error("Image too large");
    return data;
  })
  .handler(async ({ data }): Promise<AiStencilResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { error: "AI is not configured." };
    try {
      const [meta, b64in] = data.imageDataUrl.split(",");
      const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
      const bin = Uint8Array.from(atob(b64in), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("model", "openai/gpt-image-2.5-sunburst");
      form.append("prompt", PROMPT);
      form.append("image", new Blob([bin], { type: mime }), "input.png");
      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
        method: "POST",
        headers: { "Lovable-API-Key": apiKey },
        body: form,
      });
      if (res.status === 429) return { error: "AI is busy — try again in a moment." };
      if (res.status === 402) return { error: "AI credits are used up." };
      if (!res.ok) return { error: `AI error (${res.status}).` };
      const json = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
        choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
      };
      const b64 = json.data?.[0]?.b64_json;
      if (b64) return { url: `data:image/png;base64,${b64}` };
      const url = json.data?.[0]?.url ?? json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      return url ? { url } : { error: "AI returned no image." };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Network error" };
    }
  });
