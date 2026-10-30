# Permanent lösning för AR-låsets tempo och storlek

## Bekräftat i videon och koden

Den nya videon är 21,17 sekunder, 1080×2424 och cirka 50,8 fps. Efter låsning följer motivet handen i synliga steg och reagerar för sent vid riktningsbyten. Under delar där handen och kameraavståndet är relativt stabila ändrar motivet ändå storlek.

Det här är inte ett enda tröskelvärde som behöver trimmas. Nuvarande kedja skapar problemet på flera nivåer:

1. **Tracking körs på skärmens `requestAnimationFrame`, inte på nya kameraframes.** `ARCamera.tsx:1788-1796` anropar den tunga OpenCV-uppdateringen varje display-frame. På en telefon innebär det både dubbla analyser av samma kamerabild och missade/ojämna frames när huvudtråden blir belastad.
2. **Varje tracking-frame renderar om hela den stora React-komponenten.** `ARCamera.tsx:1846-1856` använder `setTransform(next)` för varje synlig rörelse. Komponenten innehåller kamera-HUD, sheets, motivstrip, capture- och scanlogik, så poseuppdateringen konkurrerar med själva bildanalysen på huvudtråden.
3. **Posen dämpas flera gånger.** `flowLock.ts:632-684` filtrerar translation, skala och rotation; `ARCamera.tsx:1736-1770` medianfiltrerar/gatar skalan igen; `ARCamera.tsx:1807-1841` interpolerar hela posen ytterligare en gång. Varje lager verkar rimligt ensamt men tillsammans ger de eftersläpning, stegvis upphämtning och svårförutsägbart beteende.
4. **Två trackers kan äga samma lås.** `ARCamera.tsx:1522-1613` kan börja med fallback-trackern och sedan byta till optical flow mitt i sessionen. Trots rebasing har motorerna olika skala, smoothing och referenser, vilket gör ett stabilt kontinuerligt tillstånd svårt.
5. **Skalan har fortfarande en kedjad referens.** `flowLock.ts:239-255` bakar aktuell mätning vid omankring och `flowLock.ts:603` multiplicerar nästa lokala skala med den bakade. Kontinuiteten är bättre än tidigare, men små skalfel kan fortfarande ackumuleras mellan omankringar. Därefter passerar värdet ännu en skalgate i kamerakomponenten.

## Lösning

### 1. Synka analysen med kameran

- Driv tracking med `HTMLVideoElement.requestVideoFrameCallback` när webbläsaren stöder det, så exakt en analys görs per ny dekodad kamerabild.
- Ha en begränsad rAF-fallback endast för webbläsare utan video-frame-callback.
- Tillåt aldrig två samtidiga OpenCV-analyser. Om en frame tar längre tid än kameraintervallet hoppas en gammal frame över i stället för att bygga kö och latens.
- Använd kameraframens timestamp i alla hastighets- och filterberäkningar.

### 2. En enda pose-controller och ett enda smoothingsteg

- Inför en liten, ren `lockPoseController` för `x`, `y`, `log(scale)` och rotation.
- Trackern lämnar en rå mätning plus kvalitet och timestamp. Controllern gör den enda filtreringen, uppskattar hastighet och predikterar posen till visningstidpunkten.
- Vid stillhet används en liten deadband för att stoppa mikrojitter. Vid verklig rörelse öppnar filtret omedelbart efter mätfel/hastighet, utan medianfönster eller extra lerp som måste “hinna ikapp”.
- Ta bort den separata skalgaten/treprovsmedianen och den andra poseinterpoleringen ur `ARCamera.tsx`; de ersätts av controllerns enda konsekventa beslut.

### 3. Separera realtidsrendering från React

- Skriv den predikterade CSS-transformen direkt till overlay-elementets ref på varje display-frame. Detta flyttar motivet utan att rendera om hela AR-vyn 30–60 gånger per sekund.
- Spegla transformen till React-state endast med låg frekvens och vid viktiga händelser (capture, save, unlock), så foto/video/PDF fortfarande får exakt senaste pose.
- Behåll GPU-transformen `translate3d/rotate/scale` och undvik layoutläsning i den heta renderloopen.

### 4. Gör skalan stabil utan att göra den långsam

- Beräkna rå skala i log-domän från robust median av avståndskvoter mellan väl separerade RANSAC-inlierpar. Det gör enstaka felmatchningar mycket mindre inflytelserika än nuvarande fitted scale.
- Kräv både god rumslig spridning och låg anisotropi innan en skalmätning får uppdatera tillståndet; annars uppdateras position men föregående skala hålls.
- Låt pose-controllern följa en sammanhängande zoom direkt, men behandla isolerade skalspikar som mätfel. Ingen separat tre-frame-fördröjning.
- Vid feature-top-up/omankring skapas en explicit kontinuitetsbrygga mellan gammal och ny lokal referens. Den senast validerade globala `logScale` bevaras exakt; omankringen får aldrig själv ändra storleken.

### 5. En tracker per låssession

- Bestäm tracker innan låset går till `locked`: optical flow när motorn är redo, annars fallback för hela sessionen.
- Ingen hot-swap mellan fallback och flow efter att låset har engagerats. Det tar bort en hel klass av positions- och skalhopp.
- Fallback-resultat går genom samma pose-controller, men dess skala accepteras bara när dess ankargeometri har tillräckligt stöd.

## Teknisk omfattning

- Ny ren modul: `src/lib/lockPoseController.ts`.
- `src/lib/flowLock.ts`: rå, timestampad pose; robust log-skala; kontinuitet vid omankring; ingen intern visningssmoothing.
- `src/components/ARCamera.tsx`: video-frame-synkad mätloop, direkt overlay-rendering via ref, lågfrekevent state-snapshot och borttagning av dubbla filter/gates.
- `src/lib/arTracker.ts`: endast om det krävs för samma råa posekontrakt och fast trackerägarskap.
- Små deterministiska tester för pose-controller och re-anchor-kontinuitet.

Tracking-lost-regler, “Too close”-hint, lock-animation, HUD, motivrendering och resten av appen lämnas oförändrade.

## Verifiering

1. Testa syntetiska sekvenser för stillhet, jämn panorering, plötslig riktningsändring, snabb zoom, enskild skalspik och omankring. Krav: ingen storleksändring vid stillhet, ingen diskontinuitet vid omankring och inget växande tidslagg.
2. Instrumentera lokalt i debug-läge: kameraframe-tid, analystid, poseålder, renderad pose och antal tappade frames. Normal UI visar inget av detta.
3. Verifiera i mobil viewport att tracking analyseras högst en gång per kameraframe och att React inte renderas per pose-frame.
4. Kör typecheck, relevanta tester, build och diffkontroll.
5. Slutlig fysisk kontroll på telefon: samma rörelsesekvens som i videon — stilla hand, snabba sidledsbyten, närmare/längre och omankring. Godkänt först när motivet följer utan synlig eftersläpning och skalan står still vid konstant avstånd.