# Step 4 – Realism & "Skin-Lock" (MediaPipe engine only)

Only the five points in your prompt, only in `/ar?engine=mediapipe`. Classic, DeepAR, menus, payments untouched.

## What is built

1. **Black vs colour ink**: the motif is checked once when loaded (how colourful it is). Black/grey motifs use Multiply blending. Colour motifs use a Multiply + Overlay mix in the shader, so colours stay strong while skin texture shows through.
2. **Temporal smoothing**: One Euro filter on all body points used and on the projector (position, angle, width, curvature, size). The tattoo should stay still; real stability can only be judged on your phone.
3. **Edge feathering**: soft edge where the tattoo meets the outline of the body, instead of a hard cut.
4. **Controls (copied Classic gestures)**: pinch = size, two-finger twist = rotate, one-finger drag = move. They move the decal projector along and around the 3D body shape (along the limb, around the arm, size, rotation), not as a flat 2D layer.
5. **Ink dispersion**: a 0.5 px blur on the motif to simulate ink in the skin.

## Technical details
- `mpProjection.ts`: colourfulness score from a downsampled canvas read of the motif; `ShaderMaterial` output = mix(multiply, overlay(skin, ink)) using the camera frame as a `VideoTexture` for skin colour (black ink: pure multiply). Feathering: sample mask at several offsets and smoothstep instead of a single hard `discard`. Blur: motif drawn through a canvas with `filter: blur(0.5px)` before upload. One Euro on all 4 landmark coords, half-width, curvature score and final decal size/angle.
- New `setControls({ scale, rotation, along, around })`: offsets the decal projector position along the limb axis and around the cylinder surface (point on surface at angle), plus size and rotation.
- `MediaPipeViewer.tsx`: pointer-event gesture handler (same gestures as Classic), `touch-action: none`; no other UI added.
- Verify: typecheck, build, Playwright load without errors.
