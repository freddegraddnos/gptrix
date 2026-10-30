/**
 * Scales a .glb file by applying a uniform scale factor to the scene's
 * root nodes. Pure JS parsing of the GLB container (12-byte header + chunks),
 * no native dependencies — works in a Worker runtime.
 */

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

type GltfJson = {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: {
    scale?: number[];
    matrix?: number[];
    translation?: number[];
    children?: number[];
  }[];
};

function pad4(n: number) {
  return (4 - (n % 4)) % 4;
}

export function applyGlbScale(input: Uint8Array, factor: number): Uint8Array {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return input;

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (view.getUint32(0, true) !== MAGIC) {
    throw new Error("invalid_glb");
  }

  let offset = 12;
  let json: GltfJson | null = null;
  let jsonRange: [number, number] | null = null;
  let bin: Uint8Array | null = null;

  while (offset + 8 <= input.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === JSON_CHUNK) {
      json = JSON.parse(new TextDecoder().decode(input.subarray(start, start + length)));
      jsonRange = [start, start + length];
    } else if (type === BIN_CHUNK) {
      bin = input.subarray(start, start + length);
    }
    offset = start + length + pad4(length);
  }

  if (!json || !jsonRange) throw new Error("invalid_glb_json");

  const sceneIndex = json.scene ?? 0;
  const roots = json.scenes?.[sceneIndex]?.nodes ?? [];
  json.nodes = json.nodes ?? [];
  for (const idx of roots) {
    const node = json.nodes[idx];
    if (!node) continue;
    if (node.matrix && node.matrix.length === 16) {
      node.matrix = node.matrix.map((v, i) => (i % 5 === 3 && i !== 15 ? v : v * factor));
      // the translation column (index 12,13,14) should also be scaled
      node.matrix[12] *= 1;
      node.matrix[13] *= 1;
      node.matrix[14] *= 1;
    } else {
      const s = node.scale ?? [1, 1, 1];
      node.scale = [s[0] * factor, s[1] * factor, s[2] * factor];
      if (node.translation) {
        node.translation = node.translation.map((v) => v * factor);
      }
    }
  }

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = pad4(jsonBytes.length);
  const jsonLen = jsonBytes.length + jsonPad;
  const binLen = bin ? bin.length + pad4(bin.length) : 0;
  const total = 12 + 8 + jsonLen + (bin ? 8 + binLen : 0);

  const out = new Uint8Array(total);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, MAGIC, true);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, total, true);
  outView.setUint32(12, jsonLen, true);
  outView.setUint32(16, JSON_CHUNK, true);
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) out[20 + jsonBytes.length + i] = 0x20;

  if (bin) {
    const binStart = 20 + jsonLen;
    outView.setUint32(binStart, binLen, true);
    outView.setUint32(binStart + 4, BIN_CHUNK, true);
    out.set(bin, binStart + 8);
  }
  return out;
}
