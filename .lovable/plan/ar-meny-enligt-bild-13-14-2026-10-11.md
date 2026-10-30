# AR-meny enligt bild 13–14

## Mål
Anpassa motivväljaren i den vanliga `/ar`-kameran till referenserna: ett tydligt separat handtag ovanför motivraden och ett öppningsbart, sökbart motivgalleri.

## Ändringar
- Ändra endast presentationen i den befintliga standardmotorns AR-meny (`ARCamera` och dess delade motivrad där det behövs).
- Lägg ett tydligt galleri-handtag ovanför motivraden enligt bild 13. Handtaget öppnar och stänger galleriet utan att påverka valt motiv eller kameraläge.
- Behåll den snabba horisontella motivraden och dess befintliga Upload, Draw, Text, egna motiv och motivval.
- Anpassa det befintliga galleriarket enligt bild 14 med:
  - sökfält,
  - stilfilter,
  - skrollbart motivrutnät,
  - tydlig markering av aktivt motiv,
  - stängning via kryss, bakgrund eller val av motiv.
- Låt sökning och stilfilter använda samma befintliga motivdata som motivraden, utan nya datakällor.
- Bevara AI creator, Text creator och sparade favoriter som redan finns i galleriet.
- Säkerställ minst 44 px tryckytor och fungerande layout på mobil och dator.

## Avgränsning
- Ändra inte kamera, tracking, AR-lås, motivets geometri, rendering eller motorval.
- Ändra inte DeepAR, MediaPipe, Classic-fallbackens teknik eller `/arv2`.
- Bild 15, motivförhandsvisning före AR, ingår inte.
- Ingen publicering.

## Verifiering
- Kontrollera på mobil och dator att handtaget syns ovanför motivraden och öppnar/stänger galleriet.
- Kontrollera sökning, stilfilter, motivval, aktiv markering och att motivraden fortfarande fungerar.
- Kontrollera att låsning fortsatt döljer motivmenyn som tidigare och att inga kamerakontroller överlappar den nya menyn.
- Kör typkontroll, relevanta tester och kontrollera att bygget är rent.
