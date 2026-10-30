# Make motifs visible in the picker, and remove white fills

Two separate problems, both visible in the sleeve builder.

## 1. You cannot see the designs in "Add a design"

The motif images are black line art on a transparent background. The picker tiles are almost black, so black-on-black is invisible. Only the few motifs that contain white ink show up.

Fix: give every motif thumbnail a light tile — a soft off-white surface with a subtle border and rounded corners — so black line art reads clearly, exactly like the light working surface already used in the sleeve canvas. The same light tile is applied to the small layer thumbnails in the builder so the layer list is readable too.

The app stays dark; only the motif tiles are light.

## 2. White areas in some motifs look bad in AR

A handful of motifs have solid white filled areas (tiger, koi, moth, dagger, raven). On skin that paints an opaque white patch instead of ink, which looks wrong.

Fix: clean the motif images once so white becomes transparent:

- Near-white pixels become fully transparent.
- Mid-grey edge pixels keep partial transparency, so lines stay smooth and do not get jagged.
- Black and dark grey ink is untouched.

After the cleanup the same files are used everywhere — picker, sleeve canvas, AR preview — so AR immediately shows ink only, no white block.

## Technical notes

- `src/routes/sleeve-builder.tsx`: picker grid buttons and layer chips get a light surface class instead of `bg-white/[0.04]`.
- One-off Pillow script over `src/assets/tattoo-*.png`: for each pixel, `alpha = clamp(255 - luminance)` applied only where the pixel is currently opaque and bright; dark pixels keep alpha 255. Re-saved as RGBA PNG at the same paths, so all imports keep working.
- Verify with a pixel check on the affected files (no opaque near-white pixels remain) plus `npx tsgo --noEmit`, `bun test`, and a build.
- The AR lock, OpenCV matching, and motif upload flows are untouched.
