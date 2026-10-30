# Font catalogue in the text tattoo tool

Bring the same "search and install a font" feature the drawing studio already has into the text tattoo tool (the one you open from the AR camera and the library).

## What you get

- A **Font catalogue** button above the font grid in the text tool.
- Tapping it opens the same search window used in the drawing studio: type a style (tattoo, script, blackletter), see previews, tap Install.
- The installed font appears immediately in the font grid, marked as your own font, and is selected right away.
- Installed fonts are remembered on the device, so they show up in both the text tool and the drawing studio.
- A small remove option on installed fonts so the grid doesn't fill up.
- Licence note stays visible in the catalogue window, as it is today.

## Technical notes

- Reuse `FontCatalogDialog` (`src/components/paint/FontCatalogDialog.tsx`) and `src/lib/paint/customFonts.ts` unchanged; no new server work — `searchDafont` / `downloadDafontFont` already exist.
- `src/lib/tattooFonts.ts`: allow a `TattooFont` to carry an optional `custom` flag and let `family` be the registered custom family (`paint-custom-<id>`). Add a helper that maps `listCustomFonts()` entries to `TattooFont` objects.
- `src/components/TextTattooTool.tsx`:
  - call `loadStoredCustomFonts()` once on mount and subscribe with `subscribeCustomFonts` so the grid re-renders after an install;
  - build the grid from `TATTOO_FONTS` plus the mapped custom fonts;
  - add the catalogue button + `FontCatalogDialog`, with `onInstalled(fontId)` selecting the new font;
  - per-font remove via `removeCustomFont`, falling back to the first built-in font if the selected one is removed.
- `renderTextMotif` needs no change: `document.fonts.load` resolves the registered FontFace family, so canvas export and the transparent PNG keep working.
- Verification: `tsgo --noEmit`, `bun test`, build, and a Playwright pass opening the text tool to confirm the catalogue opens and an installed font renders in the preview.
