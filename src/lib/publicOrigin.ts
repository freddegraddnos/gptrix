/** Public application origin; brand names, storage keys and sender domains stay unchanged. */
export const DEFAULT_SITE_ORIGIN = "https://www.inksimulator.com";

export function parsePublicOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Explicit invalid configuration must not silently send private links to another site. */
export function resolvePublicOrigin(runtimeValue?: string, buildValue?: string): string {
  for (const [name, value] of [
    ["SITE_URL", runtimeValue],
    ["VITE_SITE_URL", buildValue],
  ] as const) {
    if (value?.trim()) {
      const origin = parsePublicOrigin(value);
      if (!origin)
        throw new Error(
          `${name} must be an HTTPS origin without credentials, path, query or fragment.`,
        );
      return origin;
    }
  }
  return DEFAULT_SITE_ORIGIN;
}

export function getPublicOrigin(): string {
  const runtimeValue =
    typeof window === "undefined" && typeof process !== "undefined"
      ? process.env.SITE_URL
      : undefined;
  return resolvePublicOrigin(runtimeValue, import.meta.env?.VITE_SITE_URL);
}

export function publicSiteUrl(path: string): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    Array.from(path).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  ) {
    throw new Error("A public site URL requires an application path.");
  }
  const origin = getPublicOrigin();
  const url = new URL(path, origin);
  if (url.origin !== origin)
    throw new Error("A public site URL must stay on the configured origin.");
  return url.href;
}
