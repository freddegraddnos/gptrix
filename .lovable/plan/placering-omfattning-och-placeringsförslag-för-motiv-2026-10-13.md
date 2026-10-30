# Placering, omfattning och placeringsförslag för motiv

## 7. Två separata filter
- **Placering** (flera val): Överarm, Underarm, Hand, Hals, Rygg, Bröst, Lår, Vad, Arm (hel), Ben (helt), samt "Ingen särskild placering".
- **Omfattning** (ett val): Enskilt motiv, Halvsleeve, Helsleeve.
- En sleeve kombineras med placeringen Arm eller Ben – omfattningen ligger aldrig i placeringslistan.
- Uppladdningen: artisten väljer rekommenderade placeringar (valfritt, flera) och omfattning (standard: Enskilt motiv). "Ingen särskild placering" avmarkerar övriga.
- Butiken: två nya filterrader, "Placering" och "Omfattning", bredvid befintliga stil/kategori. Filtret visar motiv som rekommenderas för vald kroppsdel plus motiv utan särskild placering. Motivet låses aldrig – kunden kan fortfarande prova det var som helst i AR.
- Motivsidan visar "Rekommenderas för: …" som information, inte begränsning.

## 8. Placeringsförslag (valfritt, efter uppladdning)
- Efter "Publicera" visas motivet som publicerat direkt, med ett valfritt steg: "Se ett placeringsförslag".
- Artisten väljer en av de rekommenderade kroppsdelarna och ser motivet på en enkel kroppsmall (rak siluett av arm/ben/rygg/bröst/hand/hals i varumärkets stil), med möjlighet att flytta och ändra storlek.
- Knappen "Prova i kameran" öppnar befintlig AR-provning med motivet och vald kroppsdel där den stöds (underarm, överarm, vad m.fl.).
- Text: "Detta är ett placeringsförslag. Slutlig storlek och lämplighet stäms av med tatueraren."
- Steget kan hoppas över och öppnas senare från motivlistan i studiopanelen. Inget av detta krävs för att publicera.

## Tekniska detaljer
- `marketplace_motifs`: nya kolumner `placements text[] NOT NULL DEFAULT '{}'` och `coverage text NOT NULL DEFAULT 'single'` (validering via trigger: single/half_sleeve/full_sleeve; sleeve kräver arm eller leg om placeringar anges). Befintliga motiv får tom placering = "ingen särskild".
- Ren modul `src/lib/motifPlacement.ts` med listor (SV/EN), regler och filterfunktion + enhetstester (t.ex. sleeve-regeln, "ingen särskild" matchar alla placeringsfilter, filter låser inte).
- Kroppsmall som enkel SVG-komponent `BodyPlacementPreview`; motivbilden läggs ovanpå i 2D (följer regeln om 2D för stillbilder). AR-länk via befintlig `/ar?motif=` + kroppsdel-id från `bodyParts.ts` när den finns; AR-motorn ändras inte.
- Befintliga kategorier och stilar behålls; SV/EN via `tx()`.
