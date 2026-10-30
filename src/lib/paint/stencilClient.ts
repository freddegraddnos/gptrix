import type { EngineParams } from "./stencilEngine";

export type StencilResult = { w: number; h: number; data: Uint8ClampedArray };

/** One worker per client; newer requests supersede older pending ones. */
export function createStencilClient() {
  const worker = new Worker(new URL("./stencil.worker.ts", import.meta.url), { type: "module" });
  let seq = 0;
  type Waiter = { resolve: (r: StencilResult | null) => void; reject: (e: Error) => void; timer: number };
  const pending = new Map<number, Waiter>();
  const finish = (id: number) => { const p = pending.get(id); if (p) { clearTimeout(p.timer); pending.delete(id); } return p; };
  const failAll = (msg: string) => { for (const id of [...pending.keys()]) finish(id)?.reject(new Error(msg)); };
  worker.onmessage = (e: MessageEvent<{ id: number; error?: string } & StencilResult>) => {
    const { id, error, ...r } = e.data;
    const p = finish(id);
    if (!p) return;
    if (error) p.reject(new Error(error)); else p.resolve(r);
  };
  worker.onerror = (e) => { e.preventDefault(); failAll("The stencil engine ran out of memory. Try a smaller size."); };
  worker.onmessageerror = () => failAll("Stencil result could not be read.");
  return {
    async run(source: CanvasImageSource & { width: number; height: number }, maxSide: number, params: EngineParams, latestOnly = true) {
      const id = ++seq;
      if (latestOnly) for (const k of [...pending.keys()]) finish(k)?.resolve(null);
      const bitmap = await createImageBitmap(source as ImageBitmapSource);
      return new Promise<StencilResult | null>((resolve, reject) => {
        const timer = window.setTimeout(() => { finish(id); reject(new Error("The stencil took too long. Try a smaller size.")); }, 90_000);
        pending.set(id, { resolve, reject, timer });
        worker.postMessage({ id, bitmap, maxSide, params }, [bitmap]);
      });
    },
    dispose() { worker.terminate(); for (const k of [...pending.keys()]) finish(k)?.resolve(null); },
  };
}

/** Full-resolution export: max side from print size at 300 dpi. */
export const exportMaxSide = (widthMm: number, heightMm: number) => Math.round((Math.max(widthMm, heightMm) / 25.4) * 300);
