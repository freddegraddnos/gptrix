# Granskning: avvikelser mot dokument 03 och bilderna

## Egna initiativ / avvikelser jag hittat (ärlig lista)

### AR-menyn (bild 13–14) — flest avvikelser
1. **Handtaget**: Bilden visar texten "All designs · Swipe up ^". Jag byggde en knapp med texten "Browse designs" och ett lager-ikon — egen wording och utseende.
2. **Svep-gesten saknas**: Dokumentet säger "Gesten ska börja på handtaget" (svep upp ELLER tryck). Jag implementerade bara tryck.
3. **Galleriets rubrik**: Bilden visar "CHOOSE A DESIGN" i Anton. Jag skrev "Design gallery".
4. **Undertext saknas**: "Tap a motif to try it. Your camera stays open." finns inte.
5. **Räknarad saknas**: "130 designs / Free to try" finns inte.
6. **Rutnät**: Dokumentet säger "två kolumner med större motiv". Jag byggde 3–6 kolumner utan namn/stil under korten, och markering med ring istället för bildens lila bock.

### Motivbibliotek (bild 09)
7. **Extra typ-chiprad**: En andra filterrad (motivtyper) ligger kvar under genvägsraden — finns inte i bilden.
8. **"Trending"-sektion**: En "Mest delade"-sektion ovanför "Selected for inspiration" — finns inte i bilden.
9. **"Purchased" i genvägsraden**: Bilden visar bara Saved / My designs / Create a design ↗. Jag lade Purchased i samma rad (funktionen ska bevaras, men placeringen var mitt val).

### Studiosökning (bild 11)
10. **"Explore studios / Example selection"-raden saknas** ovanför korten.
11. **All locations / Near me**: Bilden visar enkla textlänkar med ikoner; jag byggde ramade knappar.

### Skapa (bild 07)
12. Inga avvikelser hittade — följer bilden.

## Rättelseplan
1. AR-handtag: byt till "All designs · Swipe up ^" enligt bild 13, lägg till svep-upp-gest på handtaget (tryck kvar).
2. AR-galleri: rubrik "CHOOSE A DESIGN", undertext, "N designs · Free to try"-rad, två kolumner med namn + stil under varje kort, lila bock på valt motiv.
3. Bibliotek: ta bort typ-chipraden och Trending-sektionen från huvudvyn (funktioner flyttas in i Filters eller tas bort efter ditt val), Purchased flyttas ur genvägsraden.
4. Studios: lägg till "Explore studios"-raden, gör All locations / Near me till enkla textlänkar enligt bilden.
5. Verifiera mot bilderna i mobil (390 px) och desktop, visa skärmdumpar innan publicering.

## Rörs inte
AR-motor, kamera, spårning, lås, motivradens skroll/långtryck, bokning, betalningar, databas. Ingen publicering utan ditt godkännande.

## Tekniska detaljer
- Filer: `src/components/ARCamera.tsx`, `src/routes/library.tsx`, `src/routes/studios.tsx`, ev. `src/components/ArtistFinder.tsx`.
- Svep-gest: touch-handlers på handtaget (dy < -40px öppnar), påverkar inte motivradens horisontella skroll.
- Dolda/köpta/sparade motiv, attribution och övriga funktioner bevaras enligt dokumentet.
