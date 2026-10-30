const KEY = "inkvision.auth.redirect";

function hasUnsafePathCharacter(value: string, rejectSpace = false): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code < 32 || code === 127 || (rejectSpace && code === 32);
  });
}

/** Only same-origin app paths may be used as a post-login destination. */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || hasUnsafePathCharacter(value, true)) return undefined;
  let path = value;
  if (/^https?:\/\//i.test(path)) {
    if (typeof window === "undefined") return undefined;
    try {
      const url = new URL(path);
      if (url.origin !== window.location.origin) return undefined;
      path = url.pathname + url.search + url.hash;
    } catch {
      return undefined;
    }
  }
  if (!path.startsWith("/") || path.startsWith("//")) return undefined;
  // Parse against a fixed origin as well: browsers normalise backslashes and
  // dot segments, so checking the raw prefix alone is not a safe boundary.
  try {
    const parsed = new URL(path, "https://inksimulator.invalid");
    if (parsed.origin !== "https://inksimulator.invalid") return undefined;
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (decodedPath.startsWith("//") || hasUnsafePathCharacter(decodedPath)) return undefined;
    if (decodedPath.replace(/\/+$/, "") === "/auth") return undefined;
    path = parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return undefined;
  }
  return path;
}

/** Remembered across an OAuth / magic-link round trip that drops the query. */
export function setPendingRedirect(path: string | undefined) {
  const safe = safeRedirect(path);
  if (typeof window === "undefined") return;
  try {
    if (safe) sessionStorage.setItem(KEY, safe);
  } catch {
    /* The explicit URL still preserves the destination. */
  }
}

export function peekPendingRedirect(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return safeRedirect(sessionStorage.getItem(KEY));
  } catch {
    return undefined;
  }
}

export function takePendingRedirect(): string | undefined {
  const pending = peekPendingRedirect();
  try {
    if (typeof window !== "undefined") sessionStorage.removeItem(KEY);
  } catch {
    /* Storage may be unavailable. */
  }
  return pending;
}
