# Step 3 – "The Infinite Decal" (projection in the MediaPipe engine)

Only the five points in your prompt, only in the new MediaPipe engine (`/ar?engine=mediapipe`). Classic, DeepAR, UI, payments and navigation are untouched.

## What is built

1. **The surface**: an invisible 3D mesh that follows the body points from MediaPipe Pose. For the arm it is a cylinder segment between shoulder–elbow or elbow–wrist (the forearm or upper arm with the best tracking). For the torso it is a near-flat plane between the shoulders and hips. It is rebuilt every frame from the tracked points.
2. **Auto-curvature**: a "Curvature Score" from the width between points compared with the body length (narrow = arm, wide = torso). Low score keeps the projection flat; high score wraps the decal around the cylinder. The score is smoothed so it does not jump.
3. **Projection**: the motif is projected onto that surface with `THREE.DecalGeometry`.
4. **Hard mask**: the Selfie Segmentation mask is sent to the tattoo's shader. Any pixel outside the person's silhouette is discarded, so the tattoo never shows in the background.
5. **Occlusion**: the tattoo fades out where the surface turns away from the camera (the fold behind the arm).
6. **Debug mode**: a temporary small toggle in the corner of the MediaPipe view that shows the 3D mesh as a faint wireframe.

## Which motif is shown
The MediaPipe view has no motif picker yet. It takes the same motif /ar already receives (from the link, shop, own design or AI), and the first standard motif if none is given. No new picker is added in this step.

## Not done in this step
- No lock, photo, video or motif strip (later steps, copied from the existing interface).

## Technical details
- New `src/lib/mpProjection.ts`: builds the surface from landmarks (cylinder or plane in pixel-space ortho, depth from landmark z), curvature score (limb width / segment length, One Euro-smoothed), DecalGeometry placement at the segment midpoint oriented by the segment axis and normal.
- `ShaderMaterial` on the decal: uniforms for the motif texture, the mask texture (`CanvasTexture` updated each frame) and screen size; `discard` when mask < 0.5; alpha × smoothstep on dot(normal, viewDir).
- `MediaPipeViewer.tsx` gets `initialTattooId`/`customImageUrl` props (passed by `ar.tsx`, same as DeepAR) and the debug toggle; `mpEngine.ts` is unchanged except for exposing landmark visibility.
- Verify: typecheck, build, Playwright load of `/ar?engine=mediapipe` without console errors; real tracking can only be tested on your phone.
