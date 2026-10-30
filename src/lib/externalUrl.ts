/**
 * Validates and normalises a studio-entered external website.
 * Returns an absolute https/http URL, or null when the value cannot be a
 * real web address. Never guesses a domain: "Beyond ink studio.com" is
 * rejected (not rewritten) so the public link stays hidden until the studio
 * corrects it.
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  // Spaces or control characters can never be part of a typed web address.
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return null;

  let candidate = value;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const labels = host.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
  const tld = labels[labels.length - 1]!;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(tld)) return null;

  return url.href;
}

/** True when the value is empty (allowed) or a valid external website. */
export function isValidOptionalWebsite(raw: string | null | undefined): boolean {
  return !raw || !raw.trim() || normalizeExternalUrl(raw) !== null;
}
