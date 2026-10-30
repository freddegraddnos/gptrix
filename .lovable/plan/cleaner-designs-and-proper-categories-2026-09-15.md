# Cleaner designs and proper categories

## 1. Remove the pale areas inside the designs

Several designs — most visibly the four realistic ones (wolf, rose, eye, lion) — are grey
drawings whose palest tones read as white patches on skin and in AR.

Every design image gets one cleaning pass:

- The palest tones become fully transparent, so no white or near-white patch is left.
- Mid greys keep partial transparency, so the shading and the realistic look stay.
- Dark ink is untouched, and edges stay soft instead of jagged.

Afterwards each image is re-trimmed tight to the ink with a small even margin, so the
centimetre size stays truthful.

## 2. Put every design in the right category

Today the library only filters by style (Blackwork, Fineline, …) and the sleeve builder
picker shows one long list. Categories exist in the data but are partly wrong — the
ornament bands sit under "Symbols", the realistic portraits under "Animals"/"Symbols".

- Two categories are added: **Patterns** and **Realistic**, alongside Animals, Flowers,
  Mandala, Symbols and Landscape.
- Every design is re-checked and moved to the category it actually belongs to.
- The library gets a category row of chips (All, Animals, Flowers, Mandala, Patterns,
  Realistic, Symbols, Landscape) under the existing style chips.
- The sleeve builder's "Designs" tab gets the same category chips above the grid, so you
  can jump straight to patterns or mandalas instead of scrolling.

Search, favourites, "My designs", "Bought", prices and sizes are unchanged.

## Technical notes

- One-off Pillow pass over `src/assets/tattoo-*.png`: alpha scaled from luminance
  (`l >= 225` → 0, `150 < l < 225` → linear fade, `l <= 150` → keep), applied only to
  currently opaque pixels; then alpha-bbox crop with a uniform 3% margin, re-saved to the
  same paths so every import keeps working.
- `src/lib/tattoos.ts`: `TattooType` gains `"Patterns"` and `"Realistic"`; exported
  `TYPES` array added; `type` corrected on every entry in `TATTOOS`.
- `src/routes/library.tsx`: new `type` filter state and chip row, folded into the existing
  filter chain next to the style filter.
- `src/routes/sleeve-builder.tsx`: category chips for the built-in "Designs" tab only,
  filtering `pickerItems`.
- Verify with a pixel check (no opaque near-white pixels remain), `npx tsgo --noEmit`,
  `bun test`, a build, and Playwright at 393px over the library and the sleeve builder
  picker.
