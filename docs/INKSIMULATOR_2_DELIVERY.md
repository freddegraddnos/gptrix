# InkSimulator 2.0 — granskningsversion

Branch: `upgrade/inksimulator-2`. Original: `0055181f1694b09bcfc50c2445c6dcee46843aed`.
Arbetet utgår från `freddegraddnos/ar-ink-canvas`, som användaren angav efter att zip-överföringen blockerats av storleksgränsen. Ingen likhet mellan zip och GitHub-version påstås.

## Implementerat i befintlig produkt

- Startsidan bevarar logga, befintlig bild, formspråk och AR-ingång. Den visar befintliga biblioteksmotiv och direkt väg till tatuerare samt studioinloggning. Storleksbeskrivningar skiljer uppskattning från kalibrering.
- Motivdetalj → rätt studioförfrågan fungerar utan att AR, eget skapande eller digitalt köp krävs. Mottagare, motiv och villkor visas före skickande. Servern kontrollerar motivets studiokoppling och sparar en oföränderlig ögonblicksbild.
- Enskilda och flera mottagare får stabila förfrågnings-ID:n. Upprepade anrop och samtidig inlämning använder samma ärenden; bilagor behåller identitet vid återförsök. Delvis mottaget ärende framställs inte som levererat mejl eller bekräftad bokning.
- Fotoprovning sparar foto, motiv och redigerbar placering lokalt i IndexedDB i högst 24 timmar. Inloggning bevarar returlänken. Molnsparning visar fel när bilder misslyckas; återställningskopian kvitteras först efter sparande. Befintlig ritmotor/lagerlagring bevaras.
- Studios använder befintlig riktig autentisering. Nytt konto kan efter e-postbekräftelse skapa ett privat väntande studioutkast med namn, frivillig ort och verksamhetsmål. Målet föreslår modulval. Publicering kräver fortsatt befintligt godkännande. Aktiva teammedlemmar får en väg till behöriga förfrågningar.
- Modulval sparas per studio med serverkontroll och RLS. Navigationen anpassas; befintliga ärenden och ekonomihistorik bevaras. Fortnox visas efter relevanta val eller befintlig anslutning och har verklig anslutningsstatus. Ett modulval ansluter ingen tjänst.
- Nya godkännandelänkar lagras som hash i stället för spelbar token på ägarläsbar profil. Administrativ studioregistrering kräver riktig plattformsadministratör. Bekräftade studios kan inte själv höja godkännandestatus via vanlig profilredigering.
- Artistmotiv har frivillig separat tillgänglighet (tillgängligt/reserverat/tatuerat), upprepbarhet, storleksförslag och pristext. Äldre motiv får ingen automatisk märkning. Artisten ändrar status uttryckligen; sparande/förfrågan reserverar aldrig motiv. Digitala filvillkor och priser ändras inte.
- Biblioteket behåller filter och scroll, visar källtyp och relevanta stilval. Studions stabila tidssektion skiljer tidsförfrågan från bokning. Förlorad konkurrens om en tid ger ingen falsk framgång; tidigare tid släpps först efter lyckad ny begäran.
- Befintlig 3D-vy kan öppna en faktisk lokal GLB 2.0 med inbäddade resurser. Format/storlek valideras. Rotera, zooma, återställ, tangentbord och felhantering används i den riktiga Three.js-visaren. Filen laddas inte upp eller publiceras. En videofil eller platt sleeve blir inte en 3D-modell.

## Verifierat och begränsningar

- Original: 150 tester passerade, TypeScript passerade.
- Senaste koden: 159 Vitest + 49 Bun/node-tester = **208 passerade**, 0 misslyckade. TypeScript `--noEmit` passerade. Riktad semantisk ESLint för sista ändringarna passerade och `git diff --check` passerade.
- Full ESLint är inte grön: originalet hade 13 623 fel och 52 varningar, främst formatering. Ingen stor global omformatering har gjorts. Se separat verifieringsrapport.
- Fyra isolerade PostgreSQL-testuppsättningar passerade: modulernas rollkontroll, motivsnapshotens oföränderlighet, privat studiouppstart/godkännandeskydd samt tillgänglighetsfältens regler/ägarskap. Testscheman är minimala fixtures, inte produktionsdatabasen.
- Chromium/IndexedDB: redigerbar fotoprovning överlever omladdning; stabil återställningsidentitet, kvittering och borttagning verifierade. Verklig GLB renderades i browser; rotation/zoom ändrade bilden och resurser frigjordes.
- Startsidan renderades på mobil utan horisontell överbredd eller page errors vid tidigare kontroll. Det senare sammanhängande navigationstestet hittade att kontoskaparlänken låg bakom intressefliken; gränssnittet korrigerades, men slutlig omkörning är kvar.
- Klient/server-byggning och förhandsrendering passerade efter `crawlLinks: false`. **Det bygget föregick de sista studio-, motiv-, 3D- och fler-mottagarändringarna. Ett fullständigt bygge av slutversionen återstår.**
- Sista webbläsar-/fullbyggnadskontrollerna blockerades när automatisk godkännandegranskning inte kunde slutföras på grund av användningsgränsen. Det var ingen bedömning att testet var osäkert. Inga alternativa vägar användes för att kringgå kontrollen.

## AR-skydd

Motorerna, `/ar`, CameraPrimer, motorvalet, globala stilar, routerträdet och befintliga paketversioner/låsfiler är oförändrade. 36 befintliga AR-geometri-/låstester passerar. Se `INKSIMULATOR_2_AR_AUDIT.md` för filkarta och kontrollsummor.

Fotoprovningens återupptagning, delad projektsparning, inloggningsretur och förfrågningskontext är ändrade indirekta beroenden. Automatiska tester bevisar inte fysisk kamerafunktion. Testa på faktisk iPhone/Android: neka/tillåt kamera, lås/rotera/skala, kalibrering, bild/export, återgång och resursfrigöring samt alternativa motorer.

## Kvar före driftsättning

1. Kör slutligt fullbygge och browserresorna igen när verktygsgränsen är löst; de finns under `tests/e2e` och kräver lokal server + Chromium.
2. Applicera granskade additiva migrationer **0057–0060 i ordning på en separat testdatabas**, därefter riktiga auth/RLS/storage-tester för ägare, admin, artist, kund och utomstående. Inga migrationer har tillämpats externt.
3. Verifiera bekräftelsemejl, studiogodkännande, privat bildåtkomst och notifieringsstatus med en testmiljö. Inga verkliga kundmeddelanden eller betalningar har skickats.
4. Testa bokningskonkurrens och ombokning mot den verkliga Supabase-policyuppsättningen. UI-förbättringen ersätter inte det testet eller serverns konfliktregler.
5. Befintliga äldre godkännandelänkar behåller kompatibilitet och sin tidigare tokenexponering. Granska/ersätt sådana väntande länkar före produktionssättning av säkerhetsändringen. Nya länkar har skyddet ovan.
6. Ett **publikt 3D-projektgalleri** återstår: repot saknar verifierad publik modellkatalog och modeller som uttryckligen får publiceras. Privata kroppsskanningar har inte gjorts offentliga. KIRI/kroppsskanning och externa kalender-, betalnings- och bokföringstjänster är inte integrationstestade.
7. Marknadsplatsmodellen knyter motiv till befintligt artist-/studioägarkonto. Separat konstnärskoppling till varje teammedlem kräver komplettering av den faktiska modellen; inga påhittade artistrelationer har införts.

## Körbarhet och återgång

Miljön använder Node 24.19, Bun 1.3.3 och de låsta paketen från `bun.lock`. `npm ci` misslyckas redan på originalet eftersom npm-låsfilen är föråldrad. Bun-låsfilens två privata Lovable-cacheprefix ersattes **endast i en extern kopia** med npm-registrets motsvarande paket-URL:er; versioner och checksummor behölls. Appens låsfiler är orörda. Installerade beroenden finns i `/workspace/ink-deps`; testverktyg i `/workspace/dev-tools`.

Lokal server startas med `npm run dev -- --host 0.0.0.0 --port 8080`. För isolerad kontroll måste Supabase-variabler uttryckligen peka på lokal/testbackend; repoets befintliga .env är inte verifierad som testmiljö. Testskripten blockerar externa browseranrop. Den officiella loggan använder Lovables befintliga asset-proxy och kan saknas i en fristående lokal skärmbild; loggan har inte ersatts.

Originalcommiten ovan är kvar på originalgrenen. Granska diffen mot den innan leverans. Ingen push, produktionspublicering eller extern databasändring har gjorts. Kodåtergång görs till originalcommiten i en ren checkout efter att nya ändringar sparats. Efter framtida databasdriftsättning behövs separat granskad rollback/backup: radera inte nya ärenden eller motivfält för att återställa gränssnittet.

Status: **implementerad granskningsversion, delvis verifierad — inte produktionsklar och inte hela målbilden färdig**.
