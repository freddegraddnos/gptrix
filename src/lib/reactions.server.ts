/** Server-only helpers for reaction uploads. */

export const SIGNED_TTL = 60 * 60 * 6;
const MAX_BYTES = 20 * 1024 * 1024;

export function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:((?:video|image)\/[a-z0-9.+-]+);base64,(.+)$/i.exec(
    dataUrl,
  );
  if (!match) throw new Error("Unsupported recording format.");
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > MAX_BYTES) throw new Error("The recording is too large.");
  return { bytes, mime: match[1]!.toLowerCase() };
}

