# Your own designs, purchases and text in the Sleeve Builder

Today "Add a design" only shows the built-in motifs. This adds your own material.

## Tabs in the design picker

The picker gets three tabs:

1. **Designs** — the built-in motifs, as today.
2. **My designs** — everything saved to My designs: photos you uploaded, motifs you drew in the drawing studio, lettering you made, and AI motifs. Newest first, with the name underneath.
3. **Bought** — designs from the gallery that are yours: free ones, ones you bought, and your own uploads if you are a studio. Designs you have not bought are not shown here (they would only be watermarked).

Tapping a design in any tab adds it to the sleeve exactly like today. Each tab shows a short line when empty, e.g. "Nothing saved yet — draw or upload a design first" with a link to the drawing studio and the gallery.

Tabs are also added to the small motif row further down the page so it matches.

## Lettering

"Add lettering" stays, and gets the font catalogue button that the text tool already has, so you can search and install fonts and use them directly on the sleeve. Installed fonts appear at the top of the font list.

## Notes

- Bought designs need you to be signed in; when signed out the "Bought" tab shows a sign-in link.
- Motif tiles keep the light background so dark line art stays visible.

## Technical

- `src/routes/sleeve-builder.tsx`: `source` state (`builtin | mine | bought`), `listMyMotifs()` + `subscribeMyMotifs` for the local list, `useMarketplace(user?.id)` filtered to `owned === true` for purchases, `useAuth()` for the signed-out state. A single `pickerItems` memo feeds both grids so the markup stays one component.
- Marketplace images are already signed URLs; they are drawn onto the canvas as `<img src>` like built-in motifs. `crossOrigin="anonymous"` on canvas export paths so "Save to My designs" keeps working with remote images; if export is blocked, fall back to fetching the image as a blob first.
- Lettering: reuse `FontCatalogDialog` and `customTattooFonts()` from `src/lib/paint/customFonts.ts`, the same wiring as `TextTattooTool.tsx`; `renderTextMotif` is unchanged.
- Verify with `npx tsgo --noEmit`, `bun test`, build, and a Playwright pass on `/sleeve-builder` at 393px checking each tab renders and a saved design can be added.
- AR lock, OpenCV matching and the marketplace purchase flow are untouched.
