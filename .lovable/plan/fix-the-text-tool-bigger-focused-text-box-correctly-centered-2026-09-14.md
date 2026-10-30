# Fix the text tool: bigger, focused text box + correctly centered preview

## Problems found

1. **Tiny text box** (`src/components/TextTattooTool.tsx`, the textarea): only 2 short rows, small text, nothing draws the eye to it on first open — it blends into the dark panel.
2. **Clipped preview text** (`src/lib/tattooFonts.ts` → `renderTextMotif`): the canvas height and the per-line baseline are computed from a fixed `FONT_PX * 1.25` line height and a baseline at 80 % of that. Decorative fonts (including Dafont catalogue fonts) have real ascenders/descenders that exceed those guesses, so glyphs get cut off and the text sits off-center in the preview image.

## Changes

### 1. Text input — bigger and immediately obvious (`src/components/TextTattooTool.tsx`)

- Add a visible label above the box: "Your text".
- Increase the box: `rows` stays 2 but with `min-h`, larger text size (`text-lg`), more padding, and a subtle accent border so it reads as the primary field.
- Auto-focus the textarea on mount (cursor blinking, keyboard opens on mobile) so the first thing a new user sees is where to type.
- Keep the 60-character limit and the existing placeholder.

### 2. Vertically centered, unclipped rendering (`src/lib/tattooFonts.ts` → `renderTextMotif`)

- Measure each line with `measureText` and use `actualBoundingBoxAscent` / `actualBoundingBoxDescent` (with the fixed line height as fallback when metrics are unavailable) to compute the true glyph extents per line.
- Size the canvas from the summed real ascents + descents + padding + curve bulge, so no glyph is ever clipped at top or bottom.
- Place each line's baseline from its accumulated real ascent instead of `lineHeight * (i + 0.8)`, giving consistent, centered spacing for any font.
- Unchanged: transparent PNG output, letter spacing, curve/arc, italic, the `renderTextMotif` signature and return value. The AR lock is untouched.

## Verification

- `tsgo` typecheck, build, `git diff --check`.
- Existing bun tests still pass.
- Playwright: open the text tool, confirm the text box is large/focused, type multi-line text with a decorative font, and screenshot-check the preview shows the full letters (tops and descenders) centered.
