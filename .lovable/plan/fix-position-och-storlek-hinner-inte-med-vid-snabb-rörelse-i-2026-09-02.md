# Fix: position och storlek hinner inte med vid snabb rörelse/inzoomning

## Vad mätningen visar (verifierat i koden)

**1. Uppdateras det varje frame?** Delvis.

- Interpolationen (det som faktiskt ritas) körs varje rAF-frame — `src/components/ARCamera.tsx:1739-1791`. Den är alltså inte throttlad.
- Men *mätningen* av ny pose (`step()`) är throttlad till ~45 Hz: `if (t - last >= 22)` på rad 1743. På en 60–120 Hz-skärm betyder det att målposen är upp till 22 ms gammal innan interpolationen ens börjar jaga den.

**2. Finns det för trög dämpning?** Ja — och den är fel-adaptiv för just inzoomning.

Grundorsaken till att storleken fastnar "för liten" vid snabb inzoomning:

- I `src/lib/flowLock.ts:517-522` beräknas `motion` **enbart** ur lateral hastighet (`hypot(mDx-smooth.dx, mDy-smooth.dy)`). En ren inzoomning rakt mot armen ger nästan ingen sidledsförflyttning → `motion ≈ 0`.
- All hastighetsadaptivitet hänger på `motion`: filter-gain (rad 523-528) och framför allt skalans stegtak `stepFrac = 0.018 + 0.12 * motion * trust` (rad 540). Vid `motion ≈ 0` är taket **1,8 % per uppdatering**. En 60 %-storleksändring kräver då ~26 uppdateringar ≈ 0,6 s — och under tiden ser motivet för litet ut. Exakt det symptomet.
- I `ARCamera.tsx:1706-1723` krävs dessutom 3 samples innan medianen släpps igenom, och spridningsgrinden `spreadLimit` växer bara med `move` — under en snabb zoom är spridningen stor *och* legitim, så enstaka fönster förkastas fortfarande.
- Interpolationens tidskonstant (`tau`, rad 1765) beror bara på *confidence*, inte på hur långt bort målet ligger. Ett stort hopp dämpas lika hårt som ett litet — därför "fel position innan den snappar tillbaka".

## Vad som ändras

Endast update-loopen för position/skala i låst läge.

1. **flowLock — motion ska se djup, inte bara sidled.** Lägg till skalans relativa hastighet (och rotationshastighet) i `motion`, så en ren inzoomning ger samma höga gain och samma höga stegtak som en panorering. Höj också det övre taket något så en snabb zoom kan hinna ifatt inom ett par frames.
2. **flowLock — stegtaket blir felproportionellt.** Utöver hastighetsdelen får taket en term som växer med hur långt den uppmätta skalan ligger från den visade: stora, väl understödda avvikelser får korrigeras snabbt, små ändringar behåller dagens hårda tak mot flimmer. Kvalitetsgrinden (`scaleSupported`, inliers/ratio) behålls oförändrad.
3. **ARCamera — mät varje frame.** Ta bort 22 ms-throttlen så `step()` körs per rAF-frame (med en billig skyddsgräns om bildrutan är extremt tät), så målposen aldrig är en frame gammal i onödan.
4. **ARCamera — medianfönstret får inte bromsa en snabb zoom.** Släpp igenom första samplet efter en godkänd stor rörelse i stället för att vänta på tre, och gör spridningsgrinden generösare när samplen är samstämmigt riktade åt samma håll.
5. **ARCamera — adaptiv interpolation.** `tau` blir beroende av felstorleken: litet fel → dagens lugna kurva (ingen ny skakighet), stort fel → kraftigt kortare tidskonstant, med en snap-tröskel för mycket stora hopp så overlayn inte glider synligt genom bilden. Samma princip appliceras separat på skala och position; rotationen behåller sin lugnare kurva.

## Vad som inte rörs

Tracking-lost-logiken, hudkontrollen, re-anchor, offscreen-detektionen och "Hold still — locking onto the skin"-animationen lämnas exakt som de är.

## Filer

- `src/lib/flowLock.ts` — `motion`-beräkning, filter-gain, skalans stegtak
- `src/components/ARCamera.tsx` — mätfrekvens i `loop()`, medianfönster/spridningsgrind, adaptiv `tau` för position och skala
