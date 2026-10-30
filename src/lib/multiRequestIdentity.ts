/** RFC 4122 UUID v5: stable recipient/attachment identity for one submission. */
export async function multiRequestId(namespace: string, name: string): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(namespace)) {
    throw new Error("Invalid request identity");
  }
  const prefix = Uint8Array.from(namespace.replaceAll("-", "").match(/../g)!, (hex) =>
    parseInt(hex, 16),
  );
  const suffix = new TextEncoder().encode(name);
  const input = new Uint8Array(prefix.length + suffix.length);
  input.set(prefix);
  input.set(suffix, prefix.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", input)).slice(0, 16);
  hash[6] = (hash[6]! & 15) | 80;
  hash[8] = (hash[8]! & 63) | 128;
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
