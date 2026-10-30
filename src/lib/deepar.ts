/** DeepAR configuration. License keys are domain-bound (one per hostname) and meant for client code. */
export const DEEPAR_KEYS: Record<string, string> = {
  "www.inksimulator.com":
    "ad6c1f0f22faf8fb2da4cd2dbf59891d77f941862215f3e5c22f47413ac6be486d6f77a4e587412d",
  "ar-ink-canvas.lovable.app":
    "e0528d8397f213a46fd36a3bfe7e84a7db2071de5f2de2c4488b2fe9b018d5da4164b89823e2a9f8",
};

export function getDeepArKey(hostname: string): string | undefined {
  return DEEPAR_KEYS[hostname];
}

/** SDK assets (wasm, models) are served from the CDN to keep the bundle small. */
export const DEEPAR_ROOT = "https://cdn.jsdelivr.net/npm/deepar@5.6.20/";

/** Which Live AR engine /ar uses by default. DeepAR is opt-in via ?engine=deepar. */
export type ArEngine = "deepar" | "mediapipe" | "classic";
export const AR_ENGINE: ArEngine = "classic";
