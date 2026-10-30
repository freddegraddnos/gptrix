# DeepAR-version och motiv som åker fritt på armen

## Läge i dag (kontrollerat i koden)
- Appen kör **DeepAR SDK 5.6.22** — både npm-paketet (`"deepar": "^5.6.22"` i package.json) och CDN-sökvägen `deepar@5.6.22` i `src/lib/deepar.ts`. Version 5.6.20 är alltså **inte** aktiv.
- DeepAR används bara för att visa kamerabilden. Själva placeringen av motivet på armen görs av vår egen spårning (MediaPipe-kroppspunkter + egen ritning), och det är den som gör att motivet glider/åker fritt — inte DeepAR-versionen i sig.

## Plan
1. **Byt till DeepAR 5.6.20** som du bad om: sätt paketet till exakt `5.6.20` (utan `^` så den inte hoppar upp igen) och ändra CDN-sökvägen till `deepar@5.6.20`.
2. **Stoppa motivet från att åka fritt:** när inga kroppspunkter hittas (eller de är för osäkra) fryses motivet på sin senaste position i stället för att följa brus. Idag kan en dålig mätning flytta motivet fritt.
3. **Kräv högre säkerhet på kroppspunkterna** innan de får flytta motivet (synlighetströskel), och låt One Euro-filtret även dämpa plötsliga hopp.
4. **Verifiera:** bygge utan fel, sidan laddar utan konsolfel, och den klassiska kameran tar fortfarande över automatiskt om DeepAR inte startar. Själva kamerakänslan behöver testas på din telefon via `/ar?engine=deepar`.

## Tekniskt
- `package.json`: `"deepar": "5.6.20"` (pinnad).
- `src/lib/deepar.ts`: `DEEPAR_ROOT = "https://cdn.jsdelivr.net/npm/deepar@5.6.20/"`.
- `src/components/DeepARViewer.tsx`: håll senaste giltiga pose när landmarks saknas eller har låg visibility; höj visibility-tröskeln för segmentval; inga ändringar i klassiska kameran.
- Notera: DeepARs egen 3D-spårning av arm/hand exponeras inte av JS-SDK:n, så "DeepAR är väldigt bra"-effekten du sett hos andra kommer från deras färdiga effektfiler (.deepar) — det kan vi utforska som ett senare steg om du vill.
