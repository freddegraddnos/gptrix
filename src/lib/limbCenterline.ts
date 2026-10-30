import * as THREE from "three";

/**
 * Curved middle axis of a scanned limb.
 *
 * Pure geometry: PCA for a first direction guess, cross-section centroids for
 * the real (bent) axis, a deterministic thin -> thick orientation, and a smooth
 * Catmull-Rom curve through the centroids. No UV coordinates here.
 */
export type LimbCenterline = {
  /** Smooth curve through the slice centroids, thin end -> thick end. */
  curve: THREE.CatmullRomCurve3;
  /** Ordered slice centroids, thin -> thick. */
  points: THREE.Vector3[];
  /** Mean cross-section radius per point, same order as `points`. */
  radii: number[];
  /** PCA direction used for slicing (points from thin to thick). */
  axis: THREE.Vector3;
  /** Arc length of the curve. */
  length: number;
  /** Number of usable slices. */
  sliceCount: number;
};

export type CenterlineOptions = {
  /** Target number of cross-sections (clamped to 20..30). */
  slices?: number;
  /** Minimum vertices for a slice to count. */
  minVerticesPerSlice?: number;
};

const MIN_VERTICES = 50;
const MIN_SLICES = 4;

/** Largest eigenvector of a symmetric 3x3 covariance matrix, via power iteration. */
function principalAxis(cov: number[]): THREE.Vector3 {
  // cov laid out row-major: [xx, xy, xz, xy, yy, yz, xz, yz, zz]
  let vx = 1;
  let vy = 1;
  let vz = 1;
  for (let i = 0; i < 64; i++) {
    const nx = cov[0] * vx + cov[1] * vy + cov[2] * vz;
    const ny = cov[3] * vx + cov[4] * vy + cov[5] * vz;
    const nz = cov[6] * vx + cov[7] * vy + cov[8] * vz;
    const len = Math.hypot(nx, ny, nz);
    if (!Number.isFinite(len) || len < 1e-12) break;
    vx = nx / len;
    vy = ny / len;
    vz = nz / len;
  }
  const v = new THREE.Vector3(vx, vy, vz);
  if (v.lengthSq() < 1e-12) return new THREE.Vector3(0, 1, 0);
  return v.normalize();
}

/** Reads positions out of a geometry as a flat Float64Array. */
function readPositions(geometry: THREE.BufferGeometry): Float64Array | null {
  const attr = geometry.getAttribute("position") as
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute
    | undefined;
  if (!attr) return null;
  const count = attr.count;
  if (count < MIN_VERTICES) return null;
  const out = new Float64Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = attr.getX(i);
    out[i * 3 + 1] = attr.getY(i);
    out[i * 3 + 2] = attr.getZ(i);
  }
  return out;
}

/**
 * Computes the bent centerline of a limb mesh.
 * Returns null for degenerate input (too few vertices or too few usable slices).
 */
export function computeLimbCenterline(
  geometry: THREE.BufferGeometry,
  options: CenterlineOptions = {},
): LimbCenterline | null {
  const pos = readPositions(geometry);
  if (!pos) return null;
  return centerlineFromPositions(pos, options);
}

/** Same as computeLimbCenterline but for a raw flat [x,y,z,...] array. */
export function centerlineFromPositions(
  pos: ArrayLike<number>,
  options: CenterlineOptions = {},
): LimbCenterline | null {
  const n = Math.floor(pos.length / 3);
  if (n < MIN_VERTICES) return null;

  const slices = Math.min(30, Math.max(20, Math.round(options.slices ?? 24)));
  const minPerSlice = Math.max(
    3,
    Math.round(options.minVerticesPerSlice ?? Math.max(3, n / (slices * 12))),
  );

  // 1. PCA on the vertex positions.
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (let i = 0; i < n; i++) {
    mx += pos[i * 3];
    my += pos[i * 3 + 1];
    mz += pos[i * 3 + 2];
  }
  mx /= n;
  my /= n;
  mz /= n;

  let xx = 0;
  let xy = 0;
  let xz = 0;
  let yy = 0;
  let yz = 0;
  let zz = 0;
  for (let i = 0; i < n; i++) {
    const dx = pos[i * 3] - mx;
    const dy = pos[i * 3 + 1] - my;
    const dz = pos[i * 3 + 2] - mz;
    xx += dx * dx;
    xy += dx * dy;
    xz += dx * dz;
    yy += dy * dy;
    yz += dy * dz;
    zz += dz * dz;
  }
  const axis = principalAxis([
    xx / n, xy / n, xz / n,
    xy / n, yy / n, yz / n,
    xz / n, yz / n, zz / n,
  ]);

  // 2. Slice along the axis and take each cross-section's centroid.
  const t = new Float64Array(n);
  let tMin = Infinity;
  let tMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const v =
      (pos[i * 3] - mx) * axis.x +
      (pos[i * 3 + 1] - my) * axis.y +
      (pos[i * 3 + 2] - mz) * axis.z;
    t[i] = v;
    if (v < tMin) tMin = v;
    if (v > tMax) tMax = v;
  }
  const span = tMax - tMin;
  if (!Number.isFinite(span) || span < 1e-9) return null;

  const sums = new Float64Array(slices * 3);
  const counts = new Int32Array(slices);
  const bin = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let b = Math.floor(((t[i] - tMin) / span) * slices);
    if (b >= slices) b = slices - 1;
    if (b < 0) b = 0;
    bin[i] = b;
    counts[b] += 1;
    sums[b * 3] += pos[i * 3];
    sums[b * 3 + 1] += pos[i * 3 + 1];
    sums[b * 3 + 2] += pos[i * 3 + 2];
  }

  const keep: number[] = [];
  const centroids: THREE.Vector3[] = [];
  for (let b = 0; b < slices; b++) {
    if (counts[b] < minPerSlice) continue;
    keep.push(b);
    centroids.push(
      new THREE.Vector3(
        sums[b * 3] / counts[b],
        sums[b * 3 + 1] / counts[b],
        sums[b * 3 + 2] / counts[b],
      ),
    );
  }
  if (keep.length < MIN_SLICES) return null;

  // Mean radial distance per kept slice (distance to the slice centroid,
  // measured perpendicular to the axis).
  const index = new Map<number, number>();
  keep.forEach((b, i) => index.set(b, i));
  const radiusSum = new Float64Array(keep.length);
  const radiusCount = new Int32Array(keep.length);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const slot = index.get(bin[i]);
    if (slot === undefined) continue;
    const c = centroids[slot];
    tmp.set(pos[i * 3] - c.x, pos[i * 3 + 1] - c.y, pos[i * 3 + 2] - c.z);
    tmp.addScaledVector(axis, -tmp.dot(axis));
    radiusSum[slot] += tmp.length();
    radiusCount[slot] += 1;
  }
  const radii: number[] = [];
  for (let i = 0; i < keep.length; i++) {
    radii.push(radiusCount[i] > 0 ? radiusSum[i] / radiusCount[i] : 0);
  }

  // 3. Deterministic orientation: thin end first (v=0), thick end last (v=1).
  const third = Math.max(1, Math.round(radii.length / 3));
  const mean = (from: number, to: number) => {
    let s = 0;
    for (let i = from; i < to; i++) s += radii[i];
    return s / Math.max(1, to - from);
  };
  const startThickness = mean(0, third);
  const endThickness = mean(radii.length - third, radii.length);
  if (startThickness > endThickness) {
    centroids.reverse();
    radii.reverse();
    axis.negate();
  }

  // 4. Smooth curve through the centroids.
  const curve = new THREE.CatmullRomCurve3(centroids, false, "centripetal");

  return {
    curve,
    points: centroids,
    radii,
    axis,
    length: curve.getLength(),
    sliceCount: centroids.length,
  };
}

/**
 * Computes a centerline from a loaded glTF scene: merges every mesh's vertices
 * into world space first, so it can be called straight from the model viewer.
 */
export function centerlineFromObject(
  root: THREE.Object3D,
  options: CenterlineOptions = {},
): LimbCenterline | null {
  root.updateWorldMatrix(true, true);
  const chunks: number[] = [];
  const v = new THREE.Vector3();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as { isMesh?: boolean }).isMesh || !mesh.geometry) return;
    const attr = mesh.geometry.getAttribute("position") as
      | THREE.BufferAttribute
      | THREE.InterleavedBufferAttribute
      | undefined;
    if (!attr) return;
    for (let i = 0; i < attr.count; i++) {
      v.set(attr.getX(i), attr.getY(i), attr.getZ(i)).applyMatrix4(mesh.matrixWorld);
      chunks.push(v.x, v.y, v.z);
    }
  });
  if (chunks.length / 3 < MIN_VERTICES) return null;
  return centerlineFromPositions(Float64Array.from(chunks), options);
}

/** In-memory store so the UV step can reuse a computed centerline. */
const cache = new Map<string, LimbCenterline>();

export function setCenterline(scanId: string, value: LimbCenterline): void {
  cache.set(scanId, value);
}

export function getCenterline(scanId: string): LimbCenterline | undefined {
  return cache.get(scanId);
}

export function clearCenterline(scanId?: string): void {
  if (scanId) cache.delete(scanId);
  else cache.clear();
}
