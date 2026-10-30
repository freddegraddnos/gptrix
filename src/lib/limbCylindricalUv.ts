import * as THREE from "three";
import type { LimbCenterline } from "@/lib/limbCenterline";

/**
 * Cylindrical UV mapping around the curved centerline of a scanned limb.
 *
 * v runs along the curve (0 at the thin end, 1 at the thick end, normalised to
 * the mesh's real extent), u runs around it (atan2 against the Frenet
 * normal/binormal). Triangles that cross the u = 1 -> 0 seam get a second UV
 * just above 1.0 instead of wrapping the texture back across the mesh.
 */

export type CylindricalUvOptions = {
  /** Curve samples used to locate the nearest point (default 240). */
  divisions?: number;
};

export type CylindricalUvResult = {
  /** Interleaved [u, v, ...] for every vertex (after any seam duplication). */
  uv: Float32Array;
  /** Positions, extended when seam vertices had to be duplicated. */
  positions: Float64Array;
  /** Triangle indices remapped onto the duplicated seam vertices. */
  indices: Uint32Array;
  /** How many vertices were duplicated for the seam. */
  seamVertices: number;
};

type Frames = {
  points: THREE.Vector3[];
  tangents: THREE.Vector3[];
  normals: THREE.Vector3[];
  binormals: THREE.Vector3[];
  arc: Float64Array;
};

function sampleFrames(curve: THREE.Curve<THREE.Vector3>, divisions: number): Frames {
  const frenet = curve.computeFrenetFrames(divisions, false);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= divisions; i++) points.push(curve.getPoint(i / divisions));
  const arc = new Float64Array(divisions + 1);
  for (let i = 1; i <= divisions; i++) {
    arc[i] = arc[i - 1] + points[i].distanceTo(points[i - 1]);
  }
  return {
    points,
    tangents: frenet.tangents,
    normals: frenet.normals,
    binormals: frenet.binormals,
    arc,
  };
}

const TAU = Math.PI * 2;

/** Pure core: maps raw positions + triangle indices to cylindrical UVs. */
export function cylindricalUvFromPositions(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  centerline: LimbCenterline,
  options: CylindricalUvOptions = {},
): CylindricalUvResult | null {
  const count = Math.floor(positions.length / 3);
  if (count < 3 || indices.length < 3) return null;

  const divisions = Math.max(32, Math.round(options.divisions ?? 240));
  const f = sampleFrames(centerline.curve, divisions);
  const total = f.arc[divisions];
  if (!Number.isFinite(total) || total < 1e-9) return null;

  const rawU = new Float64Array(count);
  const rawV = new Float64Array(count);
  const d = new THREE.Vector3();
  let vMin = Infinity;
  let vMax = -Infinity;

  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];

    // 2a. Nearest sample on the curve.
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s <= divisions; s++) {
      const p = f.points[s];
      const dx = px - p.x;
      const dy = py - p.y;
      const dz = pz - p.z;
      const dist = dx * dx + dy * dy + dz * dz;
      if (dist < bestD) {
        bestD = dist;
        best = s;
      }
    }

    // Refine along the tangent at that sample -> arc length is the raw v.
    const origin = f.points[best];
    const tan = f.tangents[best];
    d.set(px - origin.x, py - origin.y, pz - origin.z);
    const along = d.dot(tan);
    const arcHere = Math.max(0, Math.min(total, f.arc[best] + along));

    // 2b. Angle around the curve in the Frenet frame -> raw u.
    d.addScaledVector(tan, -along);
    const a = Math.atan2(d.dot(f.binormals[best]), d.dot(f.normals[best]));
    let u = a / TAU + 0.5;
    if (u < 0) u = 0;
    if (u >= 1) u = 0.999999;

    rawU[i] = u;
    rawV[i] = arcHere;
    if (arcHere < vMin) vMin = arcHere;
    if (arcHere > vMax) vMax = arcHere;
  }

  // 3. Normalise v so the mesh's real extent spans exactly 0..1.
  const vSpan = vMax - vMin;
  const inv = vSpan > 1e-9 ? 1 / vSpan : 0;
  for (let i = 0; i < count; i++) rawV[i] = (rawV[i] - vMin) * inv;

  // 4. Seam fix: a triangle whose u jumps from near 1.0 to near 0.0 straddles
  // the seam. Its low-u corners get a duplicate vertex with u + 1.
  const outPos: number[] = [];
  const outU: number[] = [];
  const outV: number[] = [];
  for (let i = 0; i < count; i++) {
    outPos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    outU.push(rawU[i]);
    outV.push(rawV[i]);
  }
  const seamClone = new Map<number, number>();
  const out = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) out[i] = indices[i];

  for (let t = 0; t + 2 < out.length; t += 3) {
    const a = out[t];
    const b = out[t + 1];
    const c = out[t + 2];
    const ua = rawU[a];
    const ub = rawU[b];
    const uc = rawU[c];
    const max = Math.max(ua, ub, uc);
    const min = Math.min(ua, ub, uc);
    if (max - min <= 0.5) continue; // no wrap across this triangle

    for (let k = 0; k < 3; k++) {
      const vi = out[t + k];
      if (rawU[vi] >= 0.5) continue;
      let clone = seamClone.get(vi);
      if (clone === undefined) {
        clone = outU.length;
        seamClone.set(vi, clone);
        outPos.push(
          positions[vi * 3],
          positions[vi * 3 + 1],
          positions[vi * 3 + 2],
        );
        outU.push(rawU[vi] + 1);
        outV.push(rawV[vi]);
      }
      out[t + k] = clone;
    }
  }

  const uv = new Float32Array(outU.length * 2);
  for (let i = 0; i < outU.length; i++) {
    uv[i * 2] = outU[i];
    uv[i * 2 + 1] = outV[i];
  }

  return {
    uv,
    positions: Float64Array.from(outPos),
    indices: out,
    seamVertices: seamClone.size,
  };
}

/**
 * Writes cylindrical UVs onto a geometry's "uv" attribute.
 * Seam vertices are duplicated, so position/normal attributes are rebuilt.
 * Returns the number of duplicated seam vertices, or null for bad input.
 */
export function applyCylindricalUv(
  geometry: THREE.BufferGeometry,
  centerline: LimbCenterline,
  options: CylindricalUvOptions = {},
): number | null {
  const posAttr = geometry.getAttribute("position") as
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute
    | undefined;
  if (!posAttr) return null;

  const count = posAttr.count;
  const positions = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = posAttr.getX(i);
    positions[i * 3 + 1] = posAttr.getY(i);
    positions[i * 3 + 2] = posAttr.getZ(i);
  }

  const indexAttr = geometry.getIndex();
  const indices = indexAttr
    ? (Array.from(indexAttr.array) as number[])
    : Array.from({ length: count }, (_, i) => i);

  const res = cylindricalUvFromPositions(positions, indices, centerline, options);
  if (!res) return null;

  const added = res.positions.length / 3 - count;
  if (added > 0) {
    // Extend every existing attribute by copying the source vertex data.
    const source: number[] = [];
    for (const [orig, clone] of clonePairs(res, count)) source[clone - count] = orig;
    for (const name of Object.keys(geometry.attributes)) {
      const attr = geometry.getAttribute(name) as THREE.BufferAttribute;
      const size = attr.itemSize;
      const next = new Float32Array((count + added) * size);
      for (let i = 0; i < count * size; i++) next[i] = attr.array[i] as number;
      for (let i = 0; i < added; i++) {
        const from = source[i] ?? 0;
        for (let k = 0; k < size; k++) {
          next[(count + i) * size + k] = attr.array[from * size + k] as number;
        }
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(next, size));
    }
  }

  geometry.setIndex(new THREE.BufferAttribute(res.indices, 1));
  geometry.setAttribute("uv", new THREE.BufferAttribute(res.uv, 2));
  geometry.attributes.uv.needsUpdate = true;
  return res.seamVertices;
}

/** Recovers which original vertex each duplicated seam vertex came from. */
function clonePairs(res: CylindricalUvResult, count: number): [number, number][] {
  const pairs: [number, number][] = [];
  const total = res.positions.length / 3;
  for (let clone = count; clone < total; clone++) {
    const x = res.positions[clone * 3];
    const y = res.positions[clone * 3 + 1];
    const z = res.positions[clone * 3 + 2];
    for (let i = 0; i < count; i++) {
      if (
        res.positions[i * 3] === x &&
        res.positions[i * 3 + 1] === y &&
        res.positions[i * 3 + 2] === z
      ) {
        pairs.push([i, clone]);
        break;
      }
    }
  }
  return pairs;
}
