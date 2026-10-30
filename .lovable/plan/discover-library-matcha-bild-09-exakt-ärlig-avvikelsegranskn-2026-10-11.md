# Discover (/library) — matcha bild 09 exakt + ärlig avvikelsegranskning

## Problem
Discover-sidan matchar inte referensbilden. Jag lade till egna element som inte fanns i mockupen.

## Avvikelser på Discover (verifierade mot skärmdump)

1. **Lila neon-glow på rubriken "FIND YOUR NEXT INK"** — bilden visar ren vit Anton-text utan glöd. Glöden kommer från den globala `.font-display`-regeln i `src/styles.css`, men på denna sida ska rubriken vara ren. → Ta bort glow på denna rubrik (utan att ändra den globala regeln som andra sidor använder).
2. **"Hide"-knapp (ögat) uppe till vänster på varje motivkort** — finns inte i bilden. → Ta bort från rutnätskorten (dölj-funktionen försvinner från korten; dolda motiv-sektionen längst ner behålls).
3. **Dela-ikon och penna (Edit in studio) i kortets nederkant** — bilden visar bara "View design →". → Ta bort båda från korten.
4. **"Purchased"-länk bredvid "Selected for inspiration"** — finns inte i bilden. → Ta bort.
5. Kortets bokmärkesstjärna uppe till höger stämmer med bilden — behålls.

## Saker som finns på sidan men inte syns i bilden (bilden visar bara toppen)
Dessa ligger under vecket och finns kvar om du inte säger annat — säg till om något ska bort:
- "My designs"-sektionen (egna uppladdade motiv)
- "Hidden designs"-sektionen
- "Marketplace soon"-sektionen
- Nollträffs-/fellägena (bild 16 bad om rensa-knapp)

## Granskning av övriga sidor mot sina bilder
Jag går igenom och rapporterar avvikelser även här innan något publiceras:
- **Skapa (bild 07)**: fyra val + Customise/Sleeve — verifieras mot bilden
- **Studiosökning (bild 10–11)**: rubrikrad, textlänkar, kortlayout — verifieras
- **AR-menyn (bild 13–14)**: handtag, gallerirubrik, 2-kolumnsrutnät, lila bock — verifieras

## Tekniskt
- Ändringar bara i `src/routes/library.tsx` (plus ev. en lokal klass som skriver över glow för denna rubrik).
- Rör inte: AR-motorn, kamera, tracking, data, auth, betalningar.
- Verifiering: Playwright-skärmdump i 390 px jämförd mot bild 09, typecheck, build.
- Ingen publicering utan ditt godkännande.
