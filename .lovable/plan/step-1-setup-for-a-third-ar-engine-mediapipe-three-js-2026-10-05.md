# Step 1 – Setup for a third AR engine (MediaPipe + Three.js)

Only the five points in your prompt. Nothing else is changed.

## What is done

1. **Install packages**: `@mediapipe/pose`, `@mediapipe/selfie_segmentation`, `@mediapipe/camera_utils`. (Three.js is already installed.)
2. **New engine core** (new file, `src/lib/mpEngine.ts`): starts MediaPipe Pose (arm/limb tracking) and MediaPipe Selfie Segmentation (skin mask), loaded in the browser only. Exposes start/stop and the latest pose + mask results. No motif placement yet.
3. **Three.js scene** (new file, `src/lib/mpScene.ts`): a camera-feed layer with a transparent Three.js canvas on top, sized to the camera's real width/height and aspect ratio, and following screen size/rotation.
4. **Fallback**: if MediaPipe fails to load, the new engine reports failure and /ar falls back to the existing Classic camera — same mechanism DeepAR uses today. The new engine is only reachable via `/ar?engine=mediapipe`; the default on /ar stays as it is.
5. **Look at the viewer**: `src/components/ARViewer.tsx` does not exist in the project. The Classic viewer is `src/components/ARCamera.tsx`, which is frozen per your rule (never alter Classic). So step 1 only reads it to note the interface (motif strip, LOCK, photo, video, upload, draw, text) that the new engine must copy in a later step. No refactor of any file now.

## Not done in this step
- No motif rendering, lock, warp or UI for the new engine.
- No changes to Classic, DeepAR, or other pages.

## Technical details
- `ArEngine` type in `src/lib/deepar.ts` gets a `"mediapipe"` value; `src/routes/ar.tsx` reads `?engine=mediapipe` and, until step 2 builds the viewer, mounts a minimal placeholder component that runs the core + scene (camera feed with empty Three.js overlay) and calls the existing fallback on error.
- MediaPipe WASM/model files loaded from jsDelivr pinned to installed versions; all imports dynamic inside effects (SSR-safe).
- Verify: typecheck, build, open `/ar?engine=mediapipe` in Playwright for no console errors.
