# Bokning, studiointresse, mejl, Sleeve Builder och ritprogrammets skala

## Resultat
- Kalenderexporter tas bort endast från steget där kunden väljer artist och bokning. Kundens sida med redan gjorda bokningar och studions kalenderkoppling lämnas kvar.
- När studion godkänner en förfrågan får den två tydliga val:
  1. skicka bokningslänken där kunden väljer en ledig tid;
  2. skriva egna tidsförslag och ett meddelande som skickas till kunden som avisering och mejl samt sparas i kundkonversationen.
- Nya studios kan inte längre skapa konto själva. Fliken blir en intresseanmälan med studionamn, kontaktperson, mejl och telefonnummer. Uppgifterna skickas endast via mejl till InkSimulator; inget konto eller publik studioprofil skapas.
- Kundens bokningsförfrågan kräver en kundbild och motivets storlek. Båda visas tydligt för studion i listan och detaljvyn. Mejlet länkar säkert till den privata förfrågan; den privata bilden bifogas inte direkt i mejlet.
- Sleeve Builder får en tydlig **Save project**-knapp som sparar den redigerbara kompositionen, inte bara en platt bild. Ett sparat projekt kan öppnas igen med motivens placering, storlek, rotation och vald kroppsdel kvar.
- Ritprogrammets kroppsmallar korrigeras så att den synliga kroppskonturen, inte PNG-filens genomskinliga marginaler, används som måttreferens. A4/A3 och utskrift fortsätter använda dokumentets verkliga millimetermått och en kontrollinje verifierar 1:1.
- Kroppskonturen ligger över importerade motiv under redigering, men tas alltid bort från utskrift, PDF, PNG, stencil och andra exporter.
- Alla app- och inloggningsmejl får InkSimulators svart/vit/violetta profil, korrekt logotyp och konsekventa typsnitt/fallbacks. Cyan tas bort. Mejlets ytterbakgrund hålls vit för stabil visning i mejlprogram.

## Genomförande

### 1. Bokning och svar från studio
- Ta bort iCal-/externa kalenderknappar från artistens publika bokningssteg, utan att ändra Google Calendar-synkningen eller kalenderalternativen efter genomförd bokning.
- Samla godkännandeflödet i studions bokningsruta: antal sittningar och längd sparas först, därefter väljer studion bokningslänk eller egna tidsförslag.
- Vid egna tidsförslag läggs förslagen och notisen i projektkonversationen och skickas till kunden via befintliga privata aviseringar och appmejl.
- Behåll avslag med förklaring och befintlig 18+-kontroll.

### 2. Studiointresse i stället för självregistrering
- Behåll studioinloggningen oförändrad för befintliga studios.
- Ersätt “Create studio” med ett enstegsformulär för de fyra begärda uppgifterna.
- Validera och begränsa formuläret på serversidan, använd en fast mottagare och ett fast mejlformat, och visa en enkel skickad-bekräftelse.
- Ta bort den publika vägen som skapar konto, lösenord och väntande studioprofil. Den separata interna administratörsvägen lämnas orörd.

### 3. Kundbild och motivstorlek
- Gör kundbild och storlek obligatoriska i vanlig bokning samt i enkel och multipel studioförfrågan.
- Ladda upp bilden innan förfrågan betraktas som skickad och säkerställ att storleken följer samma post hela vägen.
- Visa bildminiatyr och centimeter tydligt i studions inkorg och full bild i detaljvyn.
- Uppdatera bokningsmejlet så att det tydligt anger bild och storlek och leder till den privata detaljvyn.

### 4. Sleeve Builder
- Lägg en framträdande **Save project**-knapp vid huvudåtgärderna.
- Spara en redigerbar projektsnapshot med vald yta, motivkällor, positioner, storlekar, rotationer och en förhandsbild.
- Lägg till öppna/fortsätt-funktion för sparade Sleeve Builder-projekt och tydlig sparstatus.
- Samtidigt förbättras motivkontrasten enligt föregående önskemål: ljus pappersyta, tydligare kant och schackrutig transparensindikering utan att ändra motivbilderna.

### 5. Verklig skala och lagerordning i ritprogrammet
- Beskär kroppsmallarnas transparenta marginaler vid inläsning och kalibrera den synliga konturen mot mallens verkliga mått.
- Behåll millimeter som källa för dokumentstorlek och testa A4, kroppsmallar och 1:1-utskrift deterministiskt.
- Rendera kroppskonturen som ett separat låst överlägg endast på arbetsytan, ovanför importerade motiv.
- Tvinga bort konturen i samtliga export- och utskriftsvägar; ta bort det nuvarande valet att inkludera referensen när en kroppsmall används.

### 6. Mejlprofil
- Inför ett gemensamt mejlskal med InkSimulator-logotyp, svart typografi, violett accent och mejlsäkra Anton/DM Mono-liknande fallback-typsnitt.
- Uppdatera samtliga boknings-, studio-, meddelande-, OTP-, godkännande- och inloggningsmejl, inklusive de fyra mallar som fortfarande innehåller cyan.
- Behåll befintliga avsändardomäner, länkar och leveransflöden.
- Förhandsgranska alla mallar och kontrollera att dynamiska fält, svenska tecken, knappar och långa texter fungerar.

## Verifiering
- Testa hela kundflödet: välj artist, bifoga bild, ange storlek, skicka och öppna samma underlag som studio.
- Testa båda vägarna efter godkännande: bokningslänk respektive tidsförslag med notis.
- Kontrollera att intresseanmälan skickar ett enda mejl och aldrig skapar konto.
- Spara, ladda om och återöppna ett Sleeve Builder-projekt på mobil och dator.
- Mät A4/1:1 med kontrollinjen och kontrollera kroppsmall, lagerordning samt att konturen saknas i alla exporter.
- Förhandsgranska alla mejlmallar och kör relevanta tester, typkontroll, bygge och diff-kontroll.
