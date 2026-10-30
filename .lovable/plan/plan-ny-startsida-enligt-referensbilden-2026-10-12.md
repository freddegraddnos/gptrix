# Plan: ny startsida enligt referensbilden

## Omfattning
- Ändra endast den vanliga startsidan `/`; For studios, AR-motorn, kameran, spårningen, kalibreringen och renderingen lämnas orörda.
- Behåll alla nuvarande destinationer och funktioner: AR-provning, motivbibliotek, fotoprovning, Create, Profile och For studios.
- Ingen automatisk publicering.

## Första skärmen
- Bygg den mobilprioriterade kompositionen efter referensen: kompakt InkSimulator-logotyp, `SV / EN`, separat For studios-knapp, stor Anton-rubrik, kort DM Mono-ingress, tatuerad person centralt och violetta AR-markörer.
- Använd svensk text från referensen:
  - `DIN NÄSTA TATUERING.`
  - `SE DEN PÅ DIG FÖRST.`
  - `Prova storlek och placering innan du bestämmer dig.`
- Lägg in motsvarande engelska text i samma struktur. Engelska fortsätter vara standard utom för svenska webbläsare; användarens språkval sparas.
- Återskapa handlingarna och hierarkin i bilden: `Prova på mig`, `Utforska motiv`, `På ett foto` och `Skapa eget`, med motsvarande engelska etiketter och befintliga länkmål.
- Använd den befintliga gemensamma bottennavigationen Try / Discover / Create / Profile och anpassa bara dess placering mot den nya startsidan.

## Bild
- Generera en ny högupplöst vertikal bild av en blond kvinna i den mörka, eleganta fotografiska riktningen från den andra referensen, men med ett annat tydligt svartgrått tatueringsmotiv än blommotivet i bilden. Kompositionen anpassas för rubrik och handlingar enligt den första layoutreferensen.
- Bilden ska vara mörk, skarp och verklighetstrogen, utan inbyggd text, logotyp eller UI. Violetta AR-markörer läggs i gränssnittet så de förblir rena och responsiva.
- Placera fyra tydliga violett lysande hörnmarkörer runt själva tatueringen, som i layoutreferensen, utan att färga huden eller tatueringen.
- Referensskärmbilden används endast som visuell riktning och bäddas inte in på sidan.

## Befintliga avsnitt nedanför
- Behåll omdömen, `Think it — Try it — Ink it`, frågor och studiodelen med samma innehåll och länkar.
- Anpassa endast deras presentation till den nya svarta/vita/violetta posterprofilen: Anton-rubriker, DM Mono-text, skarpa konturer och återhållsamma violetta accenter.
- Lägg svensk och engelsk visning även för dessa avsnitt utan att ändra sakuppgifter eller lägga till nya påståenden.

## Dator och tillgänglighet
- På dator visas en centrerad posterkomposition med läsbar maxbredd; motivbilden sträcks inte ut över hela skärmen.
- Kontrollera mobilbredderna 320, 360, 390 och 430 px samt dator 1280 × 800 och 1440 × 900.
- Kontrollera textpassning, kontrast, tangentbordsfokus, minskad rörelse och att bottennavigationen inte täcker handlingar eller innehåll.

## Verifiering
- Testa båda språken och att språkvalet följer med efter omladdning och vidare navigation.
- Testa samtliga handlingar från startsidan mot deras befintliga destinationer.
- Kontrollera att de befintliga avsnitten finns kvar och att inga AR- eller kamerafiler har ändrats.
- Visa representativa mobil- och datorbilder för granskning. Stanna därefter utan publicering.
