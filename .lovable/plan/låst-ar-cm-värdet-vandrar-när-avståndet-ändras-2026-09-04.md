# Låst AR: cm-värdet vandrar när avståndet ändras

## Vad videon visar

Efter Lock står handen still eller rör sig bara närmare/längre bort, men cm-etiketten hoppar:
6.2 → 4.4 → 4.2 → 4.5 → 5.1 → 3.7 → 4.7 → 4.2. Motivet ser ungefär lika stort ut på huden
hela tiden — det är alltså siffran (och den underliggande storleksmodellen) som vandrar,
inte främst placeringen. Tracking lost i slutet är korrekt beteende (handen lämnar bilden)
och rörs inte.

## Vad som verkligen orsakar det

cm-värdet räknas som `BASE_WIDTH_PX * transform.scale / (pxPerCm * distRel)`.

- `transform.scale` uppdateras av låsspåraren varje gång kameran kommer närmare eller
  längre bort — det är korrekt, motivet ska bli större på skärmen när man går närmare.
- `distRel` sätts aldrig av spårningen (den står kvar på 1 hela sessionen).

Resultat: varje avståndsändring tolkas som att tatueringen byter fysisk storlek. En riktig
tatuering kan inte ändra cm-mått — den ska vara konstant medan skärmstorleken varierar.
Ovanpå det ger spårarens brus små skalvariationer som direkt syns som ±0.3–1 cm hopp.

## Plan

1. **Lås den fysiska storleken vid Lock.** När låset går i, spara cm-bredden som gällde i
   det ögonblicket som sessionens sanning.
2. **Låt spårarens skala driva avståndet, inte storleken.** I låst läge härleds `distRel`
   ur spårarens relativa skala mot lock-ögonblicket, så att `transform.scale / distRel`
   — och därmed cm — förblir konstant medan motivet fortsätter växa/krympa korrekt på skärmen.
3. **Visa ett stabilt cm-värde i låst läge.** Etiketten visar den låsta bredden i stället
   för att räknas om per frame; den ändras bara om användaren själv justerar storleken
   (pinch/slider/kalibrering), och nollställs vid unlock.
4. **Liten deadband på den visade siffran** utanför låst läge så att sista decimalen inte
   flimrar av spårningsbrus.

## Avgränsning

Endast `src/components/ARCamera.tsx` (cm/distRel-härledning och etiketten). Ingen ändring i
`flowLock.ts`, tracking-lost-logiken, "Too close"-hinten, lock-animationen eller
uppdateringsfrekvensen.

## Verifiering

Typecheck + build, samt att cm-etiketten står stilla i låst läge medan motivet ändrar
skärmstorlek när man för kameran närmare/längre bort (kräver test i telefonen).
