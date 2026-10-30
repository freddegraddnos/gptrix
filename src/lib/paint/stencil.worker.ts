/// <reference lib="webworker" />
import { runStencil, type EngineParams } from "./stencilEngine";

export const MAX_PIXELS = 12_000_000;
type Req = { id: number; bitmap: ImageBitmap; maxSide: number; params: EngineParams };

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, bitmap, maxSide, params } = e.data;
  try {
  // Cap total pixels so phones do not run out of memory.
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height), Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
  const w = Math.max(1, Math.round(bitmap.width * s));
  const h = Math.max(1, Math.round(bitmap.height * s));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = runStencil(src, w, h, params);
  (self as unknown as Worker).postMessage({ id, w, h, data: out }, [out.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : "Stencil failed" });
  }
};
