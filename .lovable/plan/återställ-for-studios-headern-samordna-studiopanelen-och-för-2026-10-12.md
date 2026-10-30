# Återställ For Studios-headern, samordna studiopanelen och förenkla bokningslänken

## 1. Matcha For Studios exakt mot referensen
- Återställ desktop-headerns struktur från bilden: InkSimulator-logga till vänster, länkarna **För studios / Så fungerar det / Kom igång**, därefter språkval och separat **Studioinloggning** med samma tunna outline-stil som referensen.
- Lägg tillbaka Dark/Bright-kontrollen direkt bredvid Svenska/English. Den använder samma sparade studiopreferens som tidigare och ska fungera i både ljust och mörkt läge.
- Behåll den befintliga mobilanpassningen, men låt alla kontroller ha minst 44 px tryckyta och fungera utan klippning vid 320 px.
- Matcha referensens första desktopvy: placering, proportioner, violett bakgrundsfade, rubrikglöd, CTA-form och kalkylatorns visuella hierarki. Befintlig godkänd copy, kalkylatorlogik och destinationer ändras inte.
- Använd samma headerfamilj på svensk och engelsk For Studios, guide, setup, intresse och studioinloggning där samma kontroller hör hemma.

## 2. Samordna studiopanelens grafiska profil
- Behåll dagens menygrupper, destinationer, behörigheter och funktioner.
- Justera panelens **Go to**-vy och omgivande panelram mot den bifogade bilden: samma svart/violetta yta, Anton-rubriker, DM Mono-text, tunna ramar, tydlig vald rad och jämn kolumnrytm.
- Säkerställ att InkSimulator-loggan, Dark/Bright och språkval känns som samma komponentfamilj som på de publika studiosidorna, utan att lägga till eller flytta arbetsfunktioner.
- Booking agent fortsätter vara märkt valfri; 1891frs sparade aktiva inställning ändras inte.

## 3. Inför kort kanonisk bokningsadress
- Skapa den publika adressen `https://www.inksimulator.com/{studio}/book`, exempelvis `https://www.inksimulator.com/1891frs/book`.
- Återanvänd exakt samma bokningsformulär, inloggningsretur, utkast, validering och sparande som dagens `/boka/{studio}`; ingen parallell bokningsfunktion skapas.
- Ändra panelens kopiera-/dela-länkar, studiosökning, offentlig studioprofil och publika API/MCP-resultat till den korta adressen.
- Behåll gamla `/boka/{studio}` som permanent omdirigering till den nya adressen så befintliga SMS, mejl, QR-koder och länkar fortsätter fungera. Bevara även omdirigering när en studio byter handle.

## 4. Verifiering
- Jämför For Studios mot referensbilden vid 1440 px och kontrollera 320, 390 och 754 px utan överlappning eller klippning.
- Kontrollera Dark/Bright, svenska/engelska och studioinloggning från headern.
- Kontrollera panelens Go to-vy, desktopsidebar och mobilmeny på svenska och engelska, med tangentbord och fokusmarkering.
- Kontrollera ny direktlänk, omladdning, login-retur och utkast på `/{studio}/book`, samt att gamla `/boka/{studio}` omdirigerar rätt.
- Rör inte AR, kunddata, agentinställningar, meddelanden, betalningar eller bokningslogik. Skicka inget och publicera inte automatiskt.

## Tekniskt
- Återanvänd `StudioTrackHeader`, `StudioThemeSwitch`, `StudioShell` och befintliga semantiska färgtokens i stället för en ny designfamilj.
- Flytta den befintliga bokningssidans implementation till en delad komponent eller den nya kanoniska route-filen; den gamla route-filen ska endast ansvara för kompatibel permanent omdirigering.
- Skapa alla nya TanStack-routefiler och uppdatera samtliga interna kanoniska länkar i samma ändring; genererad route tree redigeras aldrig manuellt.
