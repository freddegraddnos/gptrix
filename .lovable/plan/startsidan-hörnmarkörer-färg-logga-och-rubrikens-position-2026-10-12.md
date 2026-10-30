# Startsidan: hörnmarkörer, färg, logga och rubrikens position

Endast startsidans första vy ändras. Inget annat ändras och inget publiceras.

## Ändringar
1. **Hörnmarkörernas placering enligt de gröna lapparna på ditt foto**
   - Övre vänster: vid axeln, ovanför tatueringens vänstra överkant.
   - Övre höger: vid axelns högra kant, ovanför tatueringens högra överkant. Den ska synas.
   - Nedre vänster och nedre höger: vid tatueringens nederkant, strax ovanför/vid etiketten "AR-förhandsvisning".
   - Markörerna ramar in hela tatueringen från axel till nederkant.

2. **Markörernas färg enligt referensbilden**
   - Själva linjen blir nästan vit med svag lila ton (uppmätt cirka #F7F3FD).
   - Runt linjen läggs ett lila sken i referensens toner (cirka #A98EEE ytterst och #462892 längst ut).

3. **Loggan blir lite större** i sidhuvudet.

4. **Rubrikblocket flyttas ner en bit**, så det blir mer luft mellan loggan och "DIN NÄSTA TATUERING.", "SE DEN PÅ DIG INNAN STUDION" och "Prova storlek och placering innan du bestämmer dig.". Texterna själva ändras inte.

## Kontroll
- Jämför markörernas placering med fotot och färgen med referensbilden på 393 × 732.
- Kontrollera 320, 360, 390 och 430 px samt 1280 × 800 på svenska och engelska. Knapparna och bottenmenyn ska fortfarande synas utan scrollning, och rubriken får inte krocka med knapparna.

## Tekniskt
- Fil: `src/components/HomePosterPage.tsx` (positioner för `ArCorner`, kant- och skuggfärg, loggans höjdklasser, övre marginal på rubrikblocket).
