/** Local previews accept embedded GLB v2 only; never fetch external model resources. */
export const MAX_LOCAL_MODEL_BYTES = 40 * 1024 * 1024;

export function validateLocalGlb(bytes: ArrayBuffer): void {
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_LOCAL_MODEL_BYTES) {
    throw new Error("Choose a GLB file smaller than 40 MB.");
  }
  const view = new DataView(bytes);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength ||
    view.getUint32(16, true) !== 0x4e4f534a
  ) {
    throw new Error("This file is not a valid GLB 2.0 model.");
  }
  const jsonLength = view.getUint32(12, true);
  if (jsonLength === 0 || jsonLength % 4 !== 0 || 20 + jsonLength > bytes.byteLength) {
    throw new Error("This file is not a valid GLB 2.0 model.");
  }
  let document: Record<string, unknown>;
  try {
    document = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
  } catch {
    throw new Error("This file is not a valid GLB 2.0 model.");
  }
  if (
    !document ||
    typeof document !== "object" ||
    !Array.isArray(document.scenes) ||
    !document.scenes.length
  ) {
    throw new Error("The model has no scene to display.");
  }
  const inspect = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "uri" && (typeof child !== "string" || !/^data:[^,]+;base64,/i.test(child))) {
        throw new Error(
          "Export a GLB with embedded textures and buffers. External resources cannot be previewed here.",
        );
      }
      inspect(child);
    }
  };
  inspect(document);
}
