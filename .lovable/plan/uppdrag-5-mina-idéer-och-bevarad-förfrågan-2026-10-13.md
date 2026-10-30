# Uppdrag 5 — Mina idéer och bevarad förfrågan

## Nuläge (inventerat)
- Kundens sparade arbete ligger i befintliga projekt (`projects` + `project_assets` + `project_versions`). Sidan heter "My tattoos" (/projects); historik (/history), jämförelse (/compare), lookbook och sociala funktioner ligger separat utan förklarad relation.
- Projektdetaljens ARTIST-knapp leder till /studios utan att idén följer med.
- Bokningsdialogen kräver att kunden väljer projekt igen i en rullista, och storleken startar på standardvärdet 8 cm — ett kalibrerat mått kan alltså skrivas över/tappas.
- Det finns ingen markering av om ett mått är höjd, bredd eller största mått, ingen måttkälla och inget "Jag är osäker".

## Vad som byggs

### 1. Mina idéer (samma data, ingen ny modell)
- /projects visas som **Mina idéer / My ideas** (SV/EN). Överst: **Fortsätt där du slutade** = senast ändrade idé med bild, motiv, mått och knappar Öppna / Prova i AR / Hitta studio.
- Kort förklarande rad om relationen: Historik = alla AR-tester, Jämför = sida vid sida, Lookbook/profil = det du valt att visa publikt. Befintliga länkar och funktioner behålls; inga badges läggs till.

### 2. Idédetalj
- ARTIST ersätts av **Hitta studio för den här idén**, som öppnar studiosökningen med idén kopplad.
- Storlek: värde + **avser höjd / bredd / största mått** + **måttkälla** (kalibrerat i AR, kalibrerat foto, manuellt) + kryssruta **Jag är osäker** för storlek respektive placering.
- **Varianter**: spara nuvarande motiv/mått/placering som en variant inom samma idé (befintlig versionshistorik används). Två varianter kan öppnas i befintlig jämförelsesida där den stöder det.
- **Referenser**: kryss för vilka referensbilder som ska följa med en förfrågan.

### 3. Studiosökning med idé
- Med kopplad idé visas en fast rad: miniatyr, idénamn, mått, placering, "Ta bort koppling". Filter, karta, urval och scroll fungerar som idag.
- Valfri studio → profil → förfrågan behåller kopplingen (idé-id i adressen, så Tillbaka och omladdning fungerar).

### 4. Förfrågningsgranskning
- Bokningsdialogen förväljer idén och fyller motiv, mått, avser, källa, placering, osäker-flaggor och valda referenser från den. Inget standardvärde skriver över ett sparat mått; tomt mått förblir tomt.
- Ny sammanfattning **Detta delas med studion** före Skicka: motiv, mått + avser + källa, placering, referenser, foto, anteckning. Inget skickas förrän kunden trycker Skicka.
- Studiokonton förblir blockerade av befintliga serverregler (ingen ändring).

### 5. Gäst → inloggning
- Följer faktisk sparmodell: gästens AR-tester/motiv ligger lokalt; Hitta studio som gäst skickar till inloggning med återvägen till samma idé/studio och lokalt arbete importeras som idag. Ingen ny gästlagring.

## Test
- Kundkonto i testmiljö (tillfälligt, raderas efteråt): bibliotek eller eget motiv → foto ↔ AR → tillbaka → spara idé → återöppna → Hitta studio → studio → granska förfrågan; kontrollera att mått/källa/avser/placering/referenser är oförändrade. Ingen förfrågan skickas till riktig studio.
- Studiokonto: försök skicka förfrågan → blockeras.
- Gäst → inloggning med bevarat arbete.
- Små automatiska tester: mått ändras aldrig till standardvärde, sammanfattningen innehåller exakt det som skickas.
- Inget publiceras. AR/kamera orört.

## Tekniskt
- Additiv migration på `projects`: `size_dimension text` (height|width|longest, nullable), `size_source text` (ar_calibrated|photo_calibrated|manual, nullable), `size_unsure bool default false`, `placement_unsure bool default false`, `shared_reference_ids uuid[] default '{}'`. Varianter = rader i `project_versions` med snapshot av motiv/mått/placering.
- `bookings` får samma fält som nullable (additivt) så studion ser det som delades; befintlig `note`-sammanfattning behålls.
- Sökparam `idea` (uuid) på /studios, `$handle` och bokningsdialog; idén läses via kundens egen RLS-skyddade läsning.
- BookingDialog: `sizeCm` initieras tomt i stället för "8"; tillämpar projektdata en gång.
- Etiketter via `tx()` + `sv.ts`.
