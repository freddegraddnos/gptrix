const PREFIX = "sha256:";

/** Owner-readable profile data may contain a digest, never a usable approval link. */
export async function studioApprovalTokenDigest(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return (
    PREFIX + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export function isStudioApprovalBearer(token: string): boolean {
  return /^[a-f0-9]{32,128}$/i.test(token);
}

/** Legacy raw tokens remain valid; a stored digest itself is never a bearer. */
export async function studioApprovalTokenMatches(token: string, stored: string): Promise<boolean> {
  if (!isStudioApprovalBearer(token)) return false;
  const expected = stored.startsWith(PREFIX) ? await studioApprovalTokenDigest(token) : token;
  if (stored.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < stored.length; i++) diff |= stored.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
