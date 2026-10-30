# Fix: AR-låset märker inte när målet lämnar bilden

## Vad videon visar
När handleden åker ut ur bild står "Locked · Following" kvar och tatueringen ligger kvar på exakt samma skärmposition, som en klistermärke på linsen. Först när man för tillbaka handen ser man hur fel det blev.

## Varför nuvarande logik missar det

Tre saker samverkar:

1. **Spårningen låser om sig på bakgrunden.** När punkterna försvinner ur bild bygger spårmotorn om sitt mönster på samma skärmyta — som då innehåller väggen/skåpet bakom. Den nya ytan är kontrastrik, matchar utmärkt, och rapporterar hög säkerhet. Motorn "tappar" alltså aldrig något; den byter tyst mål.
2. **Förlust mäts bara som låg säkerhet.** Kameravyn förklarar tappad spårning först efter ~20 bildrutor med säkerhet under 0,3. Eftersom bakgrunden ger hög säkerhet nås det villkoret aldrig.
3. **Ingen kontroll att målet fortfarande är hud eller ens i bild.** Hudkontrollen körs bara när låset startas/ankras om från kameravyn, inte löpande. Ingen kontroll görs heller av om spårpunkterna har vandrat ut till kanten eller utanför bildramen.

Dessutom: i läget "lost" fryses posen men overlayn ritas fortfarande i full opacitet, så det syns inte tydligt att spårningen är borta.

## Plan (bara låsnings-/spårningslogiken i AR-vyn)

1. **Rapportera "utanför bild" från spårmotorn.** Låt spåruppdateringen returnera hur stor andel av punkterna som överlevde och var deras tyngdpunkt ligger. Om tyngdpunkten hamnar utanför bildramen (med liten marginal) eller andelen kvarvarande punkter rasar snabbt, flagga det som förlust i stället för att tyst bygga om mönstret.
2. **Begränsa den tysta omankringen.** Motorns interna omankring får bara ske nära den senast kända positionen och bara när den positionen fortfarande ligger inom bilden. Utanför bild: rapportera förlust, bygg inte om mönstret.
3. **Löpande hudkontroll under lås.** Sampla hudton vid motivets aktuella position några gånger per sekund. Två-tre samplingar i rad utan hudliknande ton räknas som förlust — det fångar både "handen ute ur bild" och "kameran pekar på köket".
4. **Snabbare förlustbeslut.** Sänk förlusttröskeln när flera signaler pekar åt samma håll (få punkter kvar + ingen hud + tyngdpunkt utanför ramen) så det tar ~0,3 s i stället för att aldrig hända.
5. **Tydlig visuell återkoppling.** I läget "lost" tonas motivet ned kraftigt (eller döljs helt) och etiketten visar "Tracking lost — bring the area back". Ingen frusen fullopak tatuering kvar på skärmen.
6. **Korrekt återupptagning.** När hud plus starka punkter kommer tillbaka i tillräckligt många bildrutor ankras låset om på den nya hudytan, storleksreferensen nollställs så inget hopp uppstår, och motivet tonas in igen.

## Teknisk sammanfattning
- `src/lib/flowLock.ts`: utöka resultatet med `keptRatio` och centrum i videokoordinater, plus ett `offscreen`-fält; villkora den interna omankringen på att centrum ligger inom bilden.
- `src/components/ARCamera.tsx`: i spårloopen lägg till förlustvillkor baserat på de nya fälten och en periodisk hudkontroll vid motivets position; sänk `lowFrames`-tröskeln vid samstämmiga signaler; rendera motivet nedtonat/dolt i fasen `lost` och nollställ skalsamplingarna vid återankring.
- Inget annat i appen berörs.
