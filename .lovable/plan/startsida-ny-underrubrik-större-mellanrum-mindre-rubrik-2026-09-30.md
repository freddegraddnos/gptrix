# Startsida: ny underrubrik, större mellanrum, mindre rubrik

Tre små justeringar i `src/components/TryOnStartMenu.tsx` (loggvyn på startsidan). AR-motorn, layouten i övrigt och alla knappar påverkas inte.

## Ändringar

1. **Ny underrubrik.** Texten under "Try it before it's forever" byts från
   "See the tattoo on you — live on your skin, or on a photo you already have."
   till "Don't imagine your next tattoo — see it in AR!" (din text, med korrekt apostrof och tankstreck).

2. **Mer avstånd mellan loggan och rubriken.** Loggwrapperns undermarginal ökas
   från `mb-3` till `mb-7` (ca 28 px), så rubriken lyfts tydligare från loggan.

3. **Något mindre rubriktypsnitt.** `text-[2.125rem]` → `text-[1.875rem]` (mobil)
   och `text-[2.375rem]` → `text-[2.125rem]` (≥640 px). Skuggan (`ink-shadow`)
   och radavståndet är skalade i em och följer automatiskt med.

## Verifiering

- Playwright på localhost:8080 i 393 / 768 / 1280 px: ny text syns, inga avsnitt klipps, ingen sidledes rullning.
- Bygget grönt (build-errors.log).
