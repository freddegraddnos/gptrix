# Färdigställ bokningsflödet och testa det hela vägen

## Redan på plats
- Studions månadskalender med Free/Requested/Booked/Blocked, lägg till/ta bort/blocka/avboka.
- Kunden väljer ledig tid vid Godkänd skiss, eller föreslår tid; studion accepterar och tiden skapas och bokas.
- Google Calendar kan kopplas per studio; bekräftade sessioner skrivs till Google, upptaget i Google blockerar InkVision-tider.

## Det som byggs nu

### 1. Bokad tid syns tydligt i studiokalendern
- Varje bokad rad i studiokalendern visar kundens namn, projektets titel och "Session X of Y", med en länk direkt till projektvyn.
- När studion accepterar ett tidsförslag dyker den nya raden upp i kalendern på rätt dag med samma märkning.
- Avbokar studion en bokad rad sätts sessionen till avbokad, kunden notifieras och tiden blir ledig igen.

### 2. Google Calendar hela vägen
- Alla vägar till en bokning skriver till studions Google Calendar: kundens egna tidsval, accepterat tidsförslag och tid som studion lägger in manuellt.
- Avbokning tar bort händelsen i Google; ändrad tid uppdaterar den befintliga händelsen i stället för att skapa en dubblett.
- Upptagen tid i Google hämtas automatiskt när studion öppnar kalendern och i den befintliga bakgrundskörningen, så dubbelbokning inte kan ske.
- Studior som inte kopplat Google påverkas inte alls — allt fungerar som idag.

### 3. Test av hela flödet
Ett automatiskt genomgångstest i mobilvy (390×844) som kör:
1. Studio godkänner en skiss → projektet får status Godkänd.
2. Kunden öppnar projektet, ser Available/Busy-dagar och väljer en ledig tid.
3. Bokningen syns som Booked i studiokalendern och som session under kundens "Bookings", med rätt status (Bekräftad eller Väntar på deposition beroende på studions inställning).
4. Kalenderlänkarna (Google, Outlook, Outlook jobb, telefonens kalender) finns på bokningen och Google-länken innehåller rätt datum och tid.
5. Samma test körs också via vägen "kunden föreslår tid → studion accepterar".

## Technical notes
- Studiokalendern joinar bookings (artist_project_id, session_number, user) på slot_id för etiketten; inga nya kolumner behövs.
- Google-synk centraliseras i studioCalendar.server.ts: `pushBookingToGoogle` blir upsert på extendedProperties.private.inkvisionBookingId, plus ny `removeBookingFromGoogle` som anropas vid avbokning. Alla bokningsvägar (bookProjectSession, respondTimeProposal, studio-manuell bokning, avbokning) går genom dessa.
- `syncGoogleBusy` anropas vid mount av StudioCalendar (fire-and-forget, fel sväljs) och fortsätter köras i den schemalagda jobbet i src/routes/api/public/booking-reminders.ts.
- Testet körs som Playwright-skript mot lokal dev-server med en inloggad testsession; studio- och kundvy verifieras i samma körning.
- Verifiering: typecheck, enhetstester, build, säkerhetsskanning, diff-check och Playwright-flödet ovan. AR-låset är orört.
