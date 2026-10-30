# Fix: storleken släpar efter avståndet i låst AR-läge

## Vad som händer idag

Skalan (och därmed CM-värdet) passerar **fyra** oberoende dämpningar innan den syns. Positionen passerar bara en. Det är därför sidled känns direkt medan storlek känns flera hundra ms — ibland sekunder — efter.

Kedjan, verifierad i koden:

1. `src/lib/flowLock.ts` — den uppmätta skalan får ändras max **1,8 % per uppdatering**, allt under 0,25 % nollställs, och den körs sedan genom ett One Euro-filter med mycket låg beta (0,014) alltså nästan ingen hastighetskompensation.
2. `src/components/ARCamera.tsx` — ovanpå det byggs en **rullande median som kräver 5 samples** (~110 ms innan första värdet alls finns), plus en spridningsgrind (`spread < 1.055`).
3. Samma ställe har ytterligare **1,2 % dödband och max 1,4 % steg per tick** (~45 Hz).
4. rAF-interpolationen använder `aSlow` = **1,8× längre tidskonstant** för skala än för position.

Två effekter faller ut:

- Även i bästa fall tar en verklig 30 %-avståndsändring runt 20+ ticks (~0,5 s) enbart på grund av stegtaken — och stegtaket finns i två lager efter varandra.
- Vid **snabb** avståndsändring blir sample-molnet brett, `spread < 1.055` faller, och skalan **fryses helt** tills rörelsen lugnat sig. Det är källan till fördröjningen på flera sekunder.

Avståndsberäkningen i sig körs inte throttlad lägre än renderingen (~45 Hz mätning, rAF-interpolation), så frekvens är inte problemet — dämpningen är.

## Vad som ändras

Endast skal-/avståndslogiken. Tracking-lost, re-anchor, hudkontroll, position och rotation rörs inte.

1. **flowLock**: gör skalsteget hastighetsberoende istället för hårt 1,8 %-tak — snabb, väl understödd rörelse får ta stora steg, en svag fit får fortfarande inte ändra storlek alls. Höj One Euro-beta för skala så filtret släpper efter vid verklig rörelse.
2. **ARCamera**: korta medianen till 3 samples (≈45 ms), gör spridningsgrinden dynamisk så den bara stoppar *inkonsekventa* mätningar och inte *stora* — en snabb men samstämmig zoom ska släppas igenom.
3. **ARCamera**: ta bort det andra stegtaket och sänk dödbandet till strax över synlighetströskeln, så skalan inte begränsas två gånger i rad.
4. **Interpolation**: låt skalan använda samma tidskonstant som positionen (`a` istället för `aSlow`); rotation behåller sin lugnare kurva.
5. CM-etiketten läser redan `transform.scale` och följer därför automatiskt med.

## Kvalitetskrav

Kvalitetsgrinden behålls: bara fits med tillräckligt många inliers och confidence får ändra storlek. Målet är att ta bort *dämpningen*, inte skyddet mot brus som orsakade det tidigare storlekspendlandet.

## Filer

- `src/lib/flowLock.ts` — skalsteg, dödband, One Euro-beta för skala
- `src/components/ARCamera.tsx` — medianfönster, spridningsgrind, stegtak, interpolationskonstant för skala
