# Matcha startsidans första mobilvy mot referensen

## Avgränsning
- Ändra endast den vanliga startsidans första vy.
- Behåll alla befintliga länkmål, språkval och innehåll längre ned på sidan.
- Lämna For studios-sidorna, AR-motorn, kameran, spårningen, kalibreringen och renderingen orörda.
- Publicera inte automatiskt.

## Ändringar
1. **Exakt accentfärg**
   - Ersätt startsidans nuvarande rosa accent med den uppmätta huvudfärgen från referensen, cirka `#8C60F5`.
   - Använd samma färg på underrubrikens sken, hörnmarkörer, knappkontur, ikoner och länklinjer.
   - Behåll studiosidornas färgtokens oförändrade.

2. **Typografi enligt referensen**
   - Behåll Anton för huvudrubriken och DM Mono för övrig text, men justera storlek, radavstånd och radbredder så rubrikblocket får referensens proportioner.
   - Svenska: `DIN NÄSTA` / `TATUERING.` följt av `SE DEN PÅ DIG FÖRST.`
   - Engelska får motsvarande två-radiga huvudrubrik och en separat accentfärgad underrubrik.
   - Säkerställ att texten är skarp och vänsterställd. Texten får ligga över kvinnans ansikte; tatueringen är bildens fokus.

3. **All navigation inom första skärmen**
   - Anpassa hela första sektionen efter den synliga mobilhöjden i stället för en fast minimihöjd på 784 px.
   - Komprimera de vertikala mellanrummen och skala bild/text/knappar tillsammans så huvudknappen, motivknappen, båda textlänkarna och den fasta bottennavigationen syns samtidigt utan scrollning vid 393 × 732.
   - Behåll länkarna till AR, motivbiblioteket, foto och skapa exakt som de fungerar nu.
   - Behåll större skärmar läsbara utan att ändra innehållet under första vyn.
   - Flytta porträttbilden mer mot mitten av mobilvyn så kvinnan inte ligger lika långt åt höger, utan att tatueringen tappar fokus.

4. **Hörnmarkörer enligt Fredriks skrivna placering**
   - Använd inte referensbildens markörplacering som mall; följ endast instruktionerna nedan för den nya kvinnan och hennes tatuering.
   - Flytta vänster övre markör in mot överarmen och vänster nedre markör in mot tatueringens nederkant.
   - Placera höger övre markör utanför mobilens synliga bildutsnitt så den inte syns.
   - Anpassa markörernas storlek och rotation till armens vinkel; markörerna ska rama in tatueringen, inte hela armen.
   - Placera etiketten `AR-förhandsvisning` nära motivet utan att täcka det.

## Kontroll
- Jämför sida vid sida med referensen på aktuell vy 393 × 732.
- Kontrollera även 320, 360, 390 och 430 px breda mobiler på svenska och engelska.
- Verifiera att alla fyra handlingarna och bottennavigationen syns utan scrollning, att inga texter kapas och att markörerna följer tatueringen.
- Kontrollera 1280 × 800 så mobilanpassningen inte försämrar datorvyn.
- Kontrollera att For studios fortfarande använder sin befintliga violetta profil och att bygget är felfritt.
