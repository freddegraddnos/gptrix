# Extreme närbild: storleken fastnar för liten och låset tappas

## Vad jag hittade (verifierat i koden)

Den nya Google Drive-länken är åtkomlig och returnerar en 40,7 MB MP4. Videon används som före/efter-referens för den extrema närbilden; implementationen börjar med att mäta när skalan fryser relativt när feature-antalet faller.

Vid mycket nära avstånd finns fem separata tak/gate:ar som alla slår till samtidigt.

1. **Hårt tak på uppmätt zoom.** `src/lib/flowLock.ts:490-497` förkastar hela posen om `pose.s > 3.5`. `pose.s` mäts mot senaste ankaret, så en snabb inzoomning som passerar 3,5× ger inget värde alls — varken storlek eller position uppdateras den framen.
2. **Hårt tak på visad skala.** `src/components/ARCamera.tsx:1740` klampar `scale` till `Math.min(4, …)`. Även om mätningen vore rätt kan overlayn aldrig bli större än 4× baslinjen.
3. **Skalgaten svälts när punkterna blir få.** `flowLock.ts:546-547` kräver `inliers >= max(9, kept*0.5)` och `ratio >= 0.54`, och `ARCamera.tsx:1705` kräver `inliers >= 10`. Nära kameran åker features ut ur bild snabbt, `kept` kollapsar, och då fryses skalan medan positionen fortsätter — exakt symptomet "storleken stannar för liten".
4. **Re-anchor kommer för sent.** Uppfyllning av features sker först när `kept < detectedPointCount * 0.45` (`flowLock.ts:598`). Vid hög förstoring är avgången per frame större än så mellan två uppdateringar, så punktmängden hinner dö innan den fylls på.
5. **Loss-regeln utlöses av förstoringen i sig.** `offscreen = !inFrame || keptRatio < 0.12` (`flowLock.ts:370`). När handen fyller ramen lämnar de yttre punkterna bild och centroiden glider mot 4 %-marginalen → hård förlust strax efter inzoomningen.

## Åtgärd

Endast skalberäkning och spårningsrobusthet vid närhet. Uppdateringsfrekvens, tracking-lost-bannern och lås-animationen rörs inte.

### flowLock.ts
- Ta bort den absoluta `pose.s < 3.5`-förkastningen och ersätt med **inkrementell ombakning**: när `pose.s` passerar ~2,0 bakas skalan in och punkterna lärs om direkt, så ackumulerad zoom kan växa obegränsat utan att någon frame tappas.
- Gör re-anchor proaktiv: trigga även på `keptRatio < 0.6` eller på att patchen vuxit ≥ 40 % sedan senaste ankaret, inte bara på 45 %-attrition.
- Skalgaten blir relativ till hur många punkter som faktiskt finns: `inliers >= max(6, ceil(kept*0.45))` med samma ratio-krav — en liten men samstämmig punktmängd får resiza.
- Detektion vid närbild: ROI klampas till bildens storlek, `minDistance` skalas ner när patchen är stor, så täta features nära kameran inte gallras bort till under `MIN_POINTS`.
- Ny signal i `FlowResult`: `tooClose` — sätts när patchen täcker en stor del av ramen samtidigt som `keptRatio`/`ratio` ligger lågt flera frames i rad. Ingen ny loss-väg; bara en flagga.

### ARCamera.tsx
- Höj skalklampen från 4 till ett rimligt sanity-tak (12) så nära avstånd får skala ut korrekt.
- Sänk `scaleSolid`-tröskeln till samma punktrelativa regel som i flowLock, så skalan inte fryser när `kept` är litet men matchningen är bra.
- När `tooClose` är aktiv: visa en egen, tydlig hint-chip **"Too close — back up a little"** i stället för att fortsätta rendera en storlek vi vet är fel. Chipen är separat från tracking-lost-bannern och rör varken dess text, dess haptik eller lås-animationen.

## Verifiering
Jämför representativa bildrutor från den bifogade videon före ändringen, kör typecheck och build, och diff-granska att ändringarna ligger i skal-/närhetslogiken medan loss-, banner- och armeringskoden är oförändrad. Slutlig fysisk närbildsprestanda behöver därefter bekräftas på riktig telefon.
