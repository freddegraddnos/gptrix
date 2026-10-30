# Curved centerline through a scanned body part

Add a pure calculation module that finds the bent middle axis of a scanned limb mesh. This is the foundation for cylindrical UV mapping later — no UV coordinates are produced in this step.

## What it does

Given a scanned mesh (the .glb loaded in the 3D viewer), it returns a smooth curve that runs through the middle of the limb and follows its bend, for example at the elbow, plus the measured thickness along it.

The direction is always the same across scans: the thin end (wrist) is the start, the thick end (shoulder/biceps) is the end. That way two scans of the same arm never come out flipped.

## Steps

1. Principal axis guess: PCA on the vertex positions gives the dominant direction of the limb.
2. Slicing: project all vertices onto that axis, split the span into 24 slices (configurable 20–30), take the centroid of each slice's vertices. Slices with too few vertices are skipped so noise at the ends does not pull the axis sideways.
3. Deterministic orientation: for each slice, compute mean radius (average distance from slice vertices to the slice centroid). Compare the average radius of the first and last thirds; if the start is thicker, reverse the whole point list so v=0 is the thin end and v=1 the thick end.
4. Smooth curve: build a `THREE.CatmullRomCurve3` (centripetal, not closed) through the ordered centroids.

## Technical notes

New file `src/lib/limbCenterline.ts`, browser-safe, `three` only (already a dependency).

```ts
export type LimbCenterline = {
  curve: THREE.CatmullRomCurve3;
  points: THREE.Vector3[];     // ordered slice centroids, thin -> thick
  radii: number[];             // mean radius per point, same order
  axis: THREE.Vector3;         // PCA direction used for slicing
  length: number;              // curve.getLength()
  sliceCount: number;
};

export function computeLimbCenterline(
  geometry: THREE.BufferGeometry,
  options?: { slices?: number; minVerticesPerSlice?: number },
): LimbCenterline | null;

export function centerlineFromObject(root: THREE.Object3D): LimbCenterline | null;
```

- PCA: mean-center positions, build the 3x3 covariance matrix, extract the largest eigenvector with power iteration (small, deterministic, no extra dependency).
- `centerlineFromObject` merges all mesh vertices under a loaded glTF scene into world space before computing, so it can be called straight from the existing model viewer.
- Returns `null` for degenerate input (fewer than ~50 vertices, or fewer than 4 usable slices).
- Storage for the next step: a module-level cache keyed by scan id (`setCenterline(scanId, result)` / `getCenterline(scanId)`) so the UV step can pick it up without recomputing. Nothing is written to the database.

Nothing existing is modified — no AR lock, no viewer changes, no UI. A small deterministic test on a synthetic bent tube geometry verifies that the curve follows the bend and that orientation is thin-to-thick regardless of input order.
