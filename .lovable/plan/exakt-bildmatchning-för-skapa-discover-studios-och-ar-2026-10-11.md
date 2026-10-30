# Exakt bildmatchning för Skapa, Discover, Studios och AR

## Mål
Återskapa de bifogade bilderna 07, 09, 11 och 13–15 så nära pixelidentiskt som möjligt på mobil, utan egna designtillägg. Dynamiska motiv, studior och antal fortsätter komma från riktig data; bildens exempeldata hårdkodas inte.

## Bekräftade avvikelser som rättas

### Gemensam yta och navigation
- Lägg in samma diskreta svart–violetta bakgrundsfade som syns tydligt i övre vänstra hörnet på referenserna; nuvarande sidor har platt svart bakgrund.
- Matcha innehållsbredd, sidmarginaler, toppavstånd och bottenmenyns storlek/placering mot bilderna.
- Behåll Anton och DM Mono, men matcha exakt visuell storlek, radavstånd, vikt och violett/neutral ton per element.

### Skapa — bild 07
- Matcha kortens höjd, radavstånd, violetta ton, kant, skugga, hörnradie och ikonplacering.
- Justera vertikal rytm så de fyra valen och båda sekundära länkarna ligger som i referensen, utan att bottenmenyn skymmer innehåll.
- Bevara exakt samma sex destinationer och kontokrav; ingen funktion ändras.

### Discover — bild 09 och senaste bifogade bilden
- Gör `/library` till den direkta Discover-vyn och behåll bottenmenyns Discover-länk dit.
- Matcha toppfade, rubrikblock, sökfält, de fyra synliga stilvalen, genvägsrad och avstånd exakt.
- Matcha motivkorten: två kolumner, pappersyta, bildskala, hörnradie, bokmärkets position, etikett, namn och `View design →`.
- Bevara riktiga sökresultat, sparade/egna/köpta/dolda motiv samt laddnings-, fel- och tomlägen utan att lägga extra kontroller i den avbildade första vyn.
- Ta bort den gamla Discover-mellansidan som alternativ ingång så Discover alltid öppnar motivgalleriet.

### Studios — bild 11
- Matcha rubrik, sökfält, platsrad, List/Map-växel, Filters och statusraden exakt.
- Förenkla den synliga kortpresentationen till referensens namn, ort/adress, status och `Explore studio →`; ta bort avatar, urvalscirkel och synliga Contact/Book-knappar från kortytan.
- Bevara portfolio, kontakt och bokning genom studiosidans befintliga detaljflöde; inga godkännanden, avstånd eller platser hittas på.

### AR — bilder 13 och 14
- Ändra endast menyns presentation, aldrig kamera, tracking, lås, rendering, kalibrering, geometri eller motorval.
- Gör galleri-handtaget till samma fullbreddsform, typografi, violetta linje och placering som bild 13; tryck och svep upp ska fortsätta fungera.
- Matcha galleribladets höjd, ton/fade, handtag, rubrik, stängknapp, sökfält, fyra synliga filter, räknarad och tvåkolumnskort enligt bild 14.
- Ta bort egna synliga tillägg i galleriarket som inte finns i bilden, inklusive AI/Text-raden och bokmärken ovanpå korten; funktionerna finns kvar via sina ordinarie ingångar.
- Stängning utan val lämnar valt motiv och kameratillstånd oförändrade.

### Motivdetalj — bild 15
- Lägg till den avbildade motivdetaljen från Discover: nedtonad bakomliggande vy, stor pappersbild, stängning, stil, namn, text, `Try on in AR →` och `Keep exploring`.
- Öppning/stängning bevarar sökning, filter och skrollposition; AR får rätt motiv utan motorändring.

## Kontroll
- Ta nya mobilbilder i samma 393 px bredd och jämför sida vid sida mot varje referensbild, inklusive fade, proportioner och vad som syns ovanför bottenmenyn.
- Kontrollera även datorlayout utan att ändra mobilkompositionens uttryck.
- Verifiera tangentbord/fokus, sökning/filter, bokmärken, studioflöde, galleriöppning/stängning och motivöverföring till AR.
- Kör deterministiska AR-låstester, typkontroll och byggkontroll.
- Publicera inte innan Fredrik granskat förhandsversionen och uttryckligen godkänt publicering.

## Tekniska gränser
- Presentationen görs med befintliga färg- och typografitokens; en avgränsad fade-token läggs till för dessa referensmatchade kundvyer.
- Ingen ändring av databas, auth, betalning, AR-motor, kamera, tracking, kalibrering, låsning, motivgeometri eller rendering.
