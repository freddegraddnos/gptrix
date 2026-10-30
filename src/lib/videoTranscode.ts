/**
 * Converts WebM video recordings to MP4 so every social app (Snapchat,
 * Instagram, TikTok) can read them. Our recordings are video-only (canvas
 * capture with no audio track), so a pure video transcode is sufficient.
 *
 * MP4 blobs pass through untouched; failures fall back to the original WebM
 * so sharing never breaks because of the conversion.
 */

type Mediabunny = typeof import("mediabunny");

const CONVERT_TIMEOUT_MS = 20_000;

async function convertToMp4(blob: Blob): Promise<Blob> {
  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
  } = (await import("mediabunny")) as Mediabunny;
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const conversion = await Conversion.init({ input, output });
  if (!conversion.isValid) throw new Error("No convertible tracks");
  await conversion.execute();
  const buffer = target.buffer;
  if (!buffer || !buffer.byteLength) throw new Error("Empty MP4 output");
  return new Blob([buffer], { type: "video/mp4" });
}

/**
 * Returns the blob as MP4. WebM input is transcoded (with a timeout and a
 * fallback to the original blob); everything else passes straight through.
 */
export async function ensureMp4(blob: Blob): Promise<Blob> {
  if (typeof window === "undefined") return blob;
  if (!blob.type.includes("webm")) return blob;
  try {
    const mp4 = await Promise.race([
      convertToMp4(blob),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Conversion timed out")), CONVERT_TIMEOUT_MS),
      ),
    ]);
    return mp4.size > 0 ? mp4 : blob;
  } catch {
    return blob;
  }
}

/** Replaces a video filename's extension with .mp4 (used after conversion). */
export const withMp4Extension = (filename: string) =>
  filename.replace(/\.[a-z0-9]+$/i, "") + ".mp4";
