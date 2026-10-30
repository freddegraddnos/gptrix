# Bokningsagent (Calendar Buddy) inbyggd i InkSimulator

Calendar Buddy byggs in direkt i InkSimulator, i stället för att vara en egen app. Då kan den använda studions egna tider, Google Kalender, SMS och priser. Den nuvarande Calendar Buddy-appen klarar bara en enda studio, med en gemensam kalender och inga studio-ID:n. Därför flyttas logiken hit och görs per studio. AR-låset lämnas orört.

## Det här får studion
1. **Agenten på eller av:** i studiopanelen finns en ny flik, "Bokningsagent", med ett tydligt Ja/Nej-reglage. Står det på Nej syns ingen chatt för studions kunder och länken visar "inte aktiv".
2. **Egen länk per studio:** `https://www.inksimulator.com/agent/<studionamn>`. Länken passar i Instagram-bion, Linktree och liknande. En kopiera-knapp och en QR-kod finns i panelen. Kunden behöver inte logga in för att chatta.
3. **Studions namn bredvid InkSimulator-loggan** högst upp i chatten. Klickar man på loggan kommer man till www.inksimulator.com.
4. **Tider och kalender:** agenten använder studions befintliga öppettider och tillgänglighet, de tider studion lagt in i kalendern, och upptagna tider från Google Kalender om den är kopplad. Bokade, reserverade och blockerade tider erbjuds aldrig. En kontroll i sista stund gör att två kunder aldrig kan få samma tid.
5. **Egen prissättning och tidsåtgång:** studion väljer själv hur den prissätter:
   - Timpris, fast pris per storlek (S/M/L/XL i cm), pris per tjänst, eller "pris efter konsultation".
   - Tidsåtgång per storlek eller tjänst, minsta tid, buffert mellan bokningar och hur långt fram man kan boka.
   - Om deposition krävs och hur stor den ska vara.
   - Bokningsläge: **direktbokning** eller **godkänn först**.
   - Fri text med det agenten ska kunna svara på, till exempel eftervård, åldersgräns och avbokningsregler.
6. **Motiv och storlek:** kunden kan beskriva idén, ladda upp en bild eller länka ett motiv från InkSimulator. Kunden anger också placering och storlek. Agenten räknar ut ungefärligt pris och tid enligt studions regler.
7. **När en bokning är klar:**
   - Bokningen syns i studiopanelen, märkt "Via bokningsagent", med motiv, storlek och kontaktuppgifter.
   - Studions Google Kalender får en händelse, och kunden bjuds in via sin e-post.
   - Både kund och studio får SMS via 46elks, plus e-post och en notis i appen.
   - Väljer studion "godkänn först" skickas inbjudan och boknings-SMS först när studion godkänt.
   - 18-årsgränsen gäller som vanligt.
8. **Sparade samtal:** studion kan läsa sina egna chattar i panelen. En studio kan aldrig se en annan studios chattar, priser eller bokningar.

## Det här behöver du göra efteråt
- Publicera sidan.
- E-postbekräftelser till kunder fungerar redan med InkSimulators nuvarande avsändare, så den separata appens avsändarväntan gäller inte här.
- Calendar Buddy-projektet kan sedan pensioneras, eller låtas peka vidare till nya länken.

## Technical notes
- Ny migration: `studio_agent_settings` (studio_id PK → artist_profiles.user_id, enabled, booking_mode, pricing_mode, size_tiers jsonb, hourly_rate_ore, min_minutes, buffer_minutes, horizon_days, deposit_ore, knowledge). Dessutom `agent_threads`/`agent_messages` (studio_id, anonymt sessions-ID) och `agent_bookings` (studio_id, motif_url, placement, size_cm, kund-e-post/telefon, status, google_event_id, slot_id). Allt med GRANT och RLS via `is_studio_staff`. Anonyma kunder skriver bara via serverrutten.
- Ny publik rutt `/agent/$handle` (SSR, seo()), och strömmande serverrutt `/api/public/agent/$handle/chat`. Den använder AI SDK + Lovable AI Gateway och portar verktygen från Calendar Buddys chat.server.ts: list_services, quote, find_slots, book, cancel. Studion slås upp via handle och enabled=true. Rate limit per IP och tråd.
- Lediga tider: `studio_availability` + öppna `studio_slots` + Google-upptaget via befintliga `studioCalendar.server.ts`. Bokningen gör ett atomärt anspråk, på samma sätt som `bookProjectSession`. Kalenderhändelse med attendee skapas med studions egen Google-koppling. SMS via `sms.server.ts`, notiser via `notify.server.ts` / `bookingNotify.server.ts`.
- Panelen: ny flik i StudioWorkspace (`StudioAgentSettings.tsx`) med reglage, prisregler, länk/QR och chattlogg. Befintliga flikar ändras inte.
- Chatt-UI: chattkomponenterna kopieras från Calendar Buddy och får InkSimulators tema (Anton/DM Mono, violett). Header = InkSimulatorLockup som länkar till / + studionamn.
- MCP-verktyget `book_studio` ändras inte. Verifiering: tsgo, bygge och Playwright i mobilvy. Testflödet: agent av → "inte aktiv", agent på → offert → bokning → syns i panelen.
