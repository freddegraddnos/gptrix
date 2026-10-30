# Ritverktyg i InkVision (/rita)

Portera hela ritverktyget från Canvas Canvas (sketchtrix) in i InkVision som en egen sida, i fyra etapper. Samma teknikstack (TanStack Start, React 19, Tailwind v4, shadcn) i båda projekten, så koden kan flyttas rakt av och sedan tema-anpassas.

## Etapp 1 — Sidan /rita

- Kopiera in ritmotorn och dess UI (`lib/paint/*`, `components/paint/*`, ca 13 000 rader) med allt: penslar, lager, text, stencil, print, fontkatalog, warp/transform, guider, adjust-lager.
- Ny route `/rita` som laddas lazy — koden hämtas först när sidan besöks och påverkar inte startsidan eller övriga routes.
- Tema-anpassning till InkVision: mörk bas, cyan accent, Space Grotesk-rubriker, befintliga knapp-/panelstilar. Ingen ny färgpalett.
- Egen `head()` med titel/beskrivning för sidan.
- Ingångar: verktygskort i Designs-biblioteket (bredvid AI Generator / Sleeve Builder) **och** en knapp i 3D-scanflödet.

## Etapp 2 — Öppna med förifylld bild

- Gemensam hjälpfunktion för att öppna `/rita` med en bild förifylld, med ett läge som styr om bilden blir:
  - **låst bakgrundsreferens** (samma typ ritverktyget redan har), eller
  - **vanligt redigerbart lager**.
- Bilden skickas via sessionStorage (inte URL), så stora bilder fungerar.
- Kopplas in på två ställen:
  1. Efter färdig 3D-skanning: "Rita på den här skissen" → låst bakgrundsreferens.
  2. På motiv i biblioteket: "Redigera i ritverktyget" → redigerbart lager.
- Canvasens storlek sätts efter den inlästa bildens dimensioner.
- Inga ändringar i ritverktygets befintliga funktioner.

## Etapp 3 — Spara i Mina designs (moln)

"Mina designs" ligger idag bara lokalt i webbläsaren. Enligt ditt val flyttas de till molnet:

- Ny tabell för användarens designs (namn, bild, bredd i cm, källa, tidsstämplar) och en privat bildbucket, båda låsta till inloggad användare.
- Befintliga lokala designs fortsätter visas och kan flyttas upp till kontot.
- Knappen "Spara i mina designs" läggs bredvid ritverktygets exportknappar; sparar den flaträkade bilden.
- Bekräftelse med länk till Mina designs.
- Utloggad användare får en tydlig uppmaning att logga in (och behåller sitt arbete).

## Etapp 4 — Fullständigt projekttillstånd

- Samma sparknapp sparar dessutom hela projekttillståndet till **samma** design-post: alla lager (bild-, text-, justeringslager) med typ, opacitet, blend mode, synlighet, låst/olåst, klippmask, alpha lock, ordning, linjelager och bakgrundsreferens, plus dokumentets storlek och mm-skala.
- Varje lagers pixlar sparas som en riktig PNG-fil i bildbucketen; databasposten pekar bara på filerna.
- Den flaträkade bilden är fortfarande det som visas i biblioteket — tillståndet är extra data.

## Etapp 5 — Öppna sparad design igen

- "Redigera"-knapp på designs som har sparat tillstånd; öppnar `/rita` och återskapar hela lagerstacken exakt.
- Ny sparning skriver över samma post (bild + tillstånd), med separat val "Spara som ny".

## Tekniska noteringar

- Ritmotorn är helt ramverksoberoende canvas-kod och har redan en serialisering av projektfilen (`ProjectFile`) — den återanvänds för molnsparningen, med lager-PNG:er utbrutna till storage i stället för inbäddade data-URL:er.
- Ritappens lokala IndexedDB-projektbibliotek följer med som det är; molnsparningen läggs bredvid, inte i stället.
- Nya beroenden som behövs: `fflate`. Övriga paket finns redan.
- Databasändringar görs via en migration som du godkänner innan den körs (etapp 3).
