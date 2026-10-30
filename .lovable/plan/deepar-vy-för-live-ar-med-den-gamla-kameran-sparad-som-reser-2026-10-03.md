# DeepAR-vy för Live AR, med den gamla kameran sparad som reserv

## Mål
Live AR på /ar använder en ny DeepAR-vy med din licensnyckel. Den nuvarande AR-kameran ("Classic") sparas oförändrad och kan slås på igen med en enda inställning. Den tar också över automatiskt om DeepAR inte startar.

## Upplägg (hybrid, inga egna DeepAR-filer)
- DeepAR körs med din nyckel och sköter kameran och personseparationen (bakgrundsseparering), där SDK:n lämnar ut den.
- Handleden och armen spåras med kod (handpunkter) i stället för en DeepAR-effektfil. Om DeepAR inte lämnar ut personens kontur tar vår egen personseparering över.
- Motivet ritas i ett eget lager ovanpå DeepAR-bilden med en egen shader.

## Steg
1. **Spara originalet.** Den nuvarande kameran läggs i en arkiverad kopia som inte ändras. Ett reglage (`AR_ENGINE = "deepar" | "classic"`) styr vilken kamera som används, och Classic tar över automatiskt vid fel.
2. **Installera DeepAR och skapa `DeepARViewer.tsx`.** Den laddas bara i webbläsaren och använder samma val av motiv, storlek och rotation som i dag.
3. **Låtsasdjupkarta:** personens kontur görs om till en djupkarta, där mitten är närmast och kanterna längst bort. Den cylindriska böjningen blir starkare ju närmare kanten motivet kommer, så att det ser ut att gå runt armen eller benet. Inget val av kroppsdel behövs.
4. **Bläck i huden:** vita och ljusa partier i motivet blir helt genomskinliga vid förbehandlingen. Resten blandas med multiply, så att hudens skuggor och struktur syns igenom.
5. **Stabilitet:** One Euro-filter (minCutoff 1.0, beta 0.01) körs varje bildruta på position, rotation och skala. Samma filter körs även på konturmätningen, så att motivet inte hoppar när konturen skiftar.
6. **Byt kameravyn på /ar till DeepAR-vyn.**
7. **Kontroll:** typkontroll och bygge, sidan laddas utan konsolfel, och reservläget fungerar. Den riktiga kameraupplevelsen behöver testas på din telefon.

## Tekniskt
- Projektregeln "rör aldrig AR-motorn" upphävs uttryckligen av denna förfrågan. Originalfilerna behålls orörda som reserv, och minnet uppdateras.
- Nyckeln läggs i `src/lib/deepar.ts` som publik konstant (den är domänbunden).
- Pseudodjup: avståndstransform på konturmasken, normaliserad till 0..1. Böjningsstyrkan är `1 - depth`, och UV-förskjutningen görs i en fragment-shader med premultiplied multiply.
- Handledspose från handpunkterna, filtrerad med det befintliga `oneEuro.ts`.
