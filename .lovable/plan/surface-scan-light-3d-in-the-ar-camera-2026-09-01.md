# Surface Scan (light 3D) in the AR camera

Ja — det går, utan tung 3D-rekonstruktion. Idag mäter kameran kurvatur, armens riktning, lutning, ljus och hudton om och om igen, men varje mätning är en ögonblicksbild som ersätts av nästa. Ingen data sparas över tid.

"Surface Scan" gör om detta till en insamling: du sveper kameran långsamt över t.ex. underarmen i 5-8 sekunder, appen samlar mätningar från många vinklar och bygger en liten ytprofil. Ju mer data, desto stabilare och mer verklighetstroget ligger motivet.

## Vad användaren ser

1. Ny knapp i AR-menyn: **Scan surface (beta)**.
2. Kort instruktion: "Håll motivet på huden och sväng telefonen långsamt runt armen."
3. En cirkulär progressring 0-100 % som fylls när nya, användbara vinklar registreras — inte bara av tid.
4. Live-feedback: "För snabbt", "För mörkt", "Visa hela armens kant" när mätningarna är svaga.
5. Vid klart: kort sammanfattning — uppskattad omkrets/bredd i cm, kurvatur, riktning, ljusriktning — och knappen **Använd profil**.
6. Profilen visas som en liten chip i HUD ("Scanned surface ✓") och kan slås av eller skannas om.
7. Profilen sparas per session/profil så nästa gång du öppnar AR ligger motivet direkt rätt.

## Vad som faktiskt förbättras

- **Kurvatur:** median av många mätningar istället för en osäker ögonblicksbild → wrap-styrkan slutar pendla.
- **Riktning och lutning:** armens axel läses från flera vinklar → motivet lägger sig längs armen även när du vrider handleden.
- **Storlek:** limb-bredden i pixlar över svepet kombineras med kalibreringen (px/cm) → mer trovärdig 1:1-storlek och bättre PDF-export.
- **Ljus:** ljusriktningen samlas runt armen → glansen flyttar sig korrekt när du roterar telefonen, istället för att hoppa.
- **Hudton:** medelvärde över hela svepet → färre färghopp när skuggor passerar.

## Avgränsning

Detta är inte en riktig 3D-mesh. Det är en tunnad, konisk cylindermodell av kroppsdelen (radie, längdriktning, lutning, ljus, hudton). Den fulla 3D-skanningen i "3D scan" finns kvar orörd för tatuerare/leverans.

## Teknisk plan

- **Ny modul `src/lib/surfaceProfile.ts`**
  - `createSurfaceScan()` — ackumulator som tar emot samples `{ curve, axisDeg, tilt, limbWidthPx, light, skinLuma, confidence, deviceYawHint }`.
  - Täckningsmått: samplen bucketas på uppmätt axel/lutning så progressringen ökar först när en *ny* vinkel setts.
  - `finalize()` → `SurfaceProfile` med confidence-viktad median för kurvatur/axel/lutning, medelvärde för ljusriktning och hudton, samt `widthCm` från px/cm.
  - Ren funktion, inga DOM-beroenden utöver de befintliga estimatorerna.
- **`src/lib/surfaceProfileStore.ts`** — spara/läs senaste profil (localStorage, tidsstämpel, samma mönster som `scanCalibrationStore.ts`).
- **`ARCamera.tsx`**
  - Ny scanning-state som under svepet kör de befintliga `estimateCurvature`, `estimateLimbAxis`, `estimateLight`, `sampleVideoSkinTone` på tätare intervall (~150 ms via `requestIdleCallback`-mönstret som redan används) och matar ackumulatorn.
  - När en profil är aktiv används den som utgångsvärde för `curve`, `surface` och `light`; live-mätningen fortsätter, men med kraftigare dämpning runt profilens värden istället för fritt drivande.
  - Haptik-puls när skanningen är klar, samma mönster som lock.
- **Nytt UI `src/components/SurfaceScanSheet.tsx`** — instruktion, progressring, live-tips, resultatsammanfattning, "Använd profil" / "Skanna om". Följer befintlig mörk InkVision/cyan-stil.
- Inga backend-ändringar, inga nya beroenden, ingen påverkan på lock, capture eller PDF-export utöver att de läser samma dämpade värden som idag.
