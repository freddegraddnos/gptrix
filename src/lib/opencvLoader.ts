/**
 * Lazy loader for OpenCV.js (WASM build).
 *
 * The AR lock is the only consumer, so the ~10 MB runtime is never fetched
 * until the camera is live. The promise is cached, so repeated locks reuse the
 * same runtime.
 *
 * Several public builds of `opencv.js` come and go (docs.opencv.org only keeps
 * some point releases, and a wrong URL returns an HTML 404 that the browser
 * blocks as an opaque response). The loader therefore walks a list of known
 * good sources and only accepts one once `cv.Mat` is really callable.
 */

// The OpenCV.js API is untyped; we keep it as `any` behind a narrow surface.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type CV = any;

/** Tried in order; the first one that actually initialises wins. */
const SOURCES = [
  "https://docs.opencv.org/4.9.0/opencv.js",
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js",
  "https://unpkg.com/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js",
  "https://docs.opencv.org/4.8.0/opencv.js",
];

/** Per-source budget: download + wasm instantiation on a mid-range phone. */
const SOURCE_TIMEOUT = 30000;

let promise: Promise<boolean> | null = null;
let status: "idle" | "loading" | "ready" | "failed" = "idle";

export function opencvReady(): CV | null {
  const cv = (globalThis as any).cv;
  return cv && typeof cv.Mat === "function" ? cv : null;
}

/** Coarse state for the UI: lets Lock explain a slow first load. */
export function opencvStatus() {
  if (opencvReady()) return "ready" as const;
  return status;
}

/** Resolves true once the global `cv` is a usable module, false on timeout. */
function settle(deadline: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let done = false;
    // The Emscripten module is "thenable" and resolves with itself, so ANY
    // `await`/`.then()` on it spins the promise machinery forever and freezes
    // the whole page. We therefore never touch `cv.then` — we only poll for a
    // callable `cv.Mat` and hook `onRuntimeInitialized` once.
    let hookedInit = false;
    const finish = (v: CV | null) => {
      if (done) return;
      done = true;
      // Never resolve with the module itself — see the note above.
      resolve(!!v);
    };

    const poll = () => {
      if (done) return;
      const ready = opencvReady();
      if (ready) return finish(ready);
      const cv = (globalThis as any).cv;
      if (cv && !hookedInit && typeof cv.onRuntimeInitialized !== "function") {
        hookedInit = true;
        try {
          cv.onRuntimeInitialized = () => finish(opencvReady());
        } catch {
          /* frozen module object — polling still covers us */
        }
      }
      if (Date.now() > deadline) return finish(null);
      setTimeout(poll, 120);
    };
    poll();
  });
}

async function loadFrom(url: string): Promise<boolean> {
  if (opencvReady()) return true;

  const script = document.createElement("script");
  script.src = url;
  script.async = true;
  script.dataset.opencv = url;

  const failed = new Promise<false>((resolve) => {
    script.onerror = () => resolve(false);
  });
  document.head.appendChild(script);

  const ok = await Promise.race([
    settle(Date.now() + SOURCE_TIMEOUT),
    failed.then(() => false),
  ]);
  if (!ok) {
    // Leave nothing half-initialised behind for the next candidate.
    script.remove();
    try {
      if (!opencvReady()) delete (globalThis as any).cv;
    } catch {
      /* non-configurable global — the next source will overwrite it */
    }
    return false;
  }
  return true;
}

/**
 * Kicks off (or joins) the runtime download. Resolves true when `cv` is usable.
 * It deliberately does NOT resolve with the module: the Emscripten object is a
 * self-resolving thenable and handing it to a promise hangs the page.
 */
export function loadOpenCV(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (opencvReady()) {
    status = "ready";
    return Promise.resolve(true);
  }
  if (promise) return promise;

  status = "loading";
  promise = (async () => {
    for (const url of SOURCES) {
      try {
        if (await loadFrom(url)) {
          status = "ready";
          return true;
        }
        console.warn(`[opencv] source unavailable: ${url}`);
      } catch (err) {
        console.warn(`[opencv] source failed: ${url}`, err);
      }
    }
    status = "failed";
    // Allow a later retry (e.g. the user regained connectivity).
    promise = null;
    return false;
  })();

  return promise;
}
