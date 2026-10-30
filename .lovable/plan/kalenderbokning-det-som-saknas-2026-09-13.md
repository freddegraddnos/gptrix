# Kalenderbokning — det som saknas

## Redan klart (byggt i förra steget)
- Studion har en månadskalender där tillgänglighet sätts och enskilda tider kan läggas till, blockeras eller avbokas.
- Kunden väljer själv ledig tid när projektstatus är Godkänd, med stöd för flersessionsprojekt (antal sessioner + längd per session).
- Bokad tid sätter projektstatus till Bokad och syns under kundens "Bookings" i profilen, med kalenderlänkar.
- Kunder ser aldrig studions kalenderinnehåll — bara lediga tider visas (bokade/blockerade tider syns inte alls).

## Nytt i den här planen

### 1. Kunden kan föreslå tid när studion inte har lediga tider
- När projektet är Godkänd men studion inte lagt in några lediga tider (eller inga passar) får kunden en "Propose a time"-knapp i projektvyn istället för bara texten "no free times right now".
- Kunden väljer datum och ungefärlig tid i en enkel mobilvänlig väljare och kan lämna en kort kommentar.
- Förslaget hamnar i projektets konversation och som en notis (in-app + e-post, respekterar kundens inställningar) till studion: "The client proposed a time for session X".
- Studion kan i projektvyn acceptera förslaget (då skapas/bokas tiden automatiskt enligt samma regler som vanlig bokning — depositionkrav gäller) eller svara med ett motförslag.
- Max 3 öppna förslag per projekt åt gången, för att undvika spam.

### 2. Ledigt/Upptaget-markering för kunder (engelska)
- I kundens tidsväljare visas kommande 14 dagar med en enkel markering per dag: "Available" (minst en ledig tid) eller "Busy" — aldrig några detaljer om vad som ligger i studions kalender, inga kundnamn, inga anteckningar.
- Dagar märkta Busy kan inte väljas. Ingen information om bokade tiders innehåll exponeras — datan kommer från den befintliga säkra public_slots-funktionen som bara returnerar lediga tider; Busy härleds enbart som "dag utan lediga tider".

## Technical notes
- Förslagsflödet lagras i projektets befintliga meddelandetabell (artist_project_messages) med ett strukturerat förslagsmeddelande (datum + tidsintervall + kommentar) — ingen ny tabell behövs. Accepterandet återanvänder bookProjectSession-logiken: studion skapar en tid i rätt läge och bokar den åt kunden via samma serverfunktion som används idag, så deposition, påminnelser och status Booked följer med automatiskt.
- Notiser går via befintliga notify-flödet (in-app, web push och e-post enligt per-person-inställningar och quiet hours). SMS ingår inte.
- Ingen ny kalenderdata exponeras för kunder: allt bygger på den befintliga RPC:n public_slots som endast returnerar öppna tider (RLS oförändrad).
- Ny UI-copy på engelska. AR-låset är orört.
- Verifiering: typecheck, enhetstester, build, säkerhetsskanning och ett Playwright-test i mobilvy (390×844) som går igenom: kund utan lediga tider ser "Propose a time", skickar förslag, studion accepterar, kunden ser sessionen under Bookings.
