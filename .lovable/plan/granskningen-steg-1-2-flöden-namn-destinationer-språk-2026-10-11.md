# Granskningen: steg 1–2 (flöden, namn, destinationer, språk)

Följer dokumentets genomförandeordning. Inga visuella omdesigner, ingen ändring av AR-motor, kamera, spårning, kalibrering, betalningar, behörigheter eller databas. Allt lämnas opublicerat för granskning. Varje textändring nedan listas ordagrant — inga andra texter rörs.

## Dina beslut
- Primär studioväg: **Väntelista**.
- Motivförsäljning: **Pilot**.
- Explore studio: **visa studioprofil först**.
- Omfattning: **steg 1–2**.

## Steg 1 — Knappnamn, destinationer, gamla hänvisningar

1. **Try i bottenmenyn** leder till provningsverktyget (`/ar`) i stället för startsidan. Logotypen leder fortfarande hem. (Fynd 1)
2. **"Back to the camera" på inloggningen** leder till `/ar`, inte `/`. (Fynd 1)
3. **Explore studio** i studiolistan leder till studions befintliga offentliga profilsida; där heter förfrågningsknappen "Send my idea" / "Skicka min idé". Saknar studion profil heter listknappen "Send request" och leder som idag direkt till formuläret. (Fynd 2)
4. **Guidens "Community → Studios"** (sv och en, text + bildtext) ändras till den verkliga vägen: "Discover → Studios" / "Utforska → Studios" enligt nuvarande meny. (Fynd 5)
5. **"Läs studioguiden" på prissidan** leder till `/sv/studio-guide/setup` (resp. engelsk motsvarighet). (Fynd 5)
6. **Motivförsäljning = Pilot**: ett gemensamt "Pilot"-märke visas där köp/försäljning nämns — biblioteket (ersätter "inte öppen"-texten), funktionsguiden, setup-guiden och Sleeve Builders BOUGHT. Ingen funktion tas bort. (Fynd 4)
7. **Inloggningsgränser behåller destination**: Aviseringar och Historik skickar `?redirect=` till inloggningen likt övriga sidor. (Fynd 11)

## Steg 2 — En studioprocess och konsekvent språk

1. **Väntelista som primär väg**: "Book a free demo"/"Boka kostnadsfri demo" (fast knapp på For studios och funktionsguiden) och guidens "ANSLUT MIN STUDIO" leder till väntelistformuläret (`/for-studios/interest`, `/sv/...`). Knapptexterna ändras till samma etikett som formuläret: "Join the waiting list" / "Ställ dig på väntelistan". Mejl och telefon finns kvar som sekundära länkar med ärliga etiketter: "Email us" / "Mejla oss", "Call us" / "Ring oss". Formulärets bekräftelse förklarar nästa steg. (Fynd 3)
   - Detta ändrar godkänd For studios-copy — sker endast med ditt godkännande av denna plan.
2. **Samma språkval överallt i studioresan**: kontrollen "Svenska | English" (som på For studios) ersätter ENG/SWE i setup-guiden och växlingen på prissidan. Valet sparas och följer med till artistinloggningen. (Fynd 7)
3. **Engelska rester på svenska sidor**: svenska funktionsguidens "Book a free demo!" och "DARK/BRIGHT" översätts ("Ställ dig på väntelistan", "MÖRK/LJUS"). (Fynd 7)

## Utanför denna omgång (dokumentets steg 3–6)
Fynd 6, 8, 9, 10, 12 samt hela visuella systemet (A–H). Tas i senare omgångar efter godkännande.

## Verifiering
- Playwright 360/390/430 px och dator, sv + en: varje ändrad knapp leder rätt, inget horisontellt scroll, fasta knappar täcker inget.
- Test för redirect-parametern och för Try-destinationen.
- AR-tester, typecheck och build ska vara gröna. Ingen publicering.

## Tekniska detaljer
- `BottomNav.tsx` (Try `to`), `routes/auth.tsx` (back-länk), `ArtistFinder.tsx` (destination/etikett baserat på om offentlig profil finns), `ForStudiosGuide.tsx` (rader 84/89/218/223, ANSLUT-knapp, språkväxlare), `routes/pricing.tsx` (guide-länk, språkkontroll), `ForStudiosPage.tsx` + `ForStudiosFeaturesPage.tsx` (demo/kontakt), `library.tsx` + Sleeve Builder (Pilot-märke via delad liten komponent), `notifications.tsx`/`history.tsx` (redirect), `StudioInterestPage.tsx` (bekräftelsetext), `usePublicStudioLang` för delat språkval.
- Minnet uppdateras med beslut: väntelista primär, motivförsäljning Pilot.
