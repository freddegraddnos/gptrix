# Bokningar i studiopanelen: detaljvy, godkänn med sittningar, avvisa med kommentar

## Vad studion ser
- Varje bokning i listan under Bokningar går att klicka på.
- En detaljruta öppnas (helskärm på mobil, ruta på dator) med:
  - Kundens namn, e-post och telefon (om angivet)
  - Önskat datum/tid, placering, storlek, beskrivning
  - Kundens bild(er)/motiv i stort format, klickbara för förstoring
- Två knappar längst ner: **Godkänn** och **Avvisa**. SV/EN följer språkvalet uppe till höger.

## Godkänn
- Rutan frågar: antal sittningar och längd per sittning (t.ex. 2 × 4 h). Snabbval 1–4 sittningar och 1–8 h, plus fritt fält.
- Tryck "Godkänn och skicka bokningslänk":
  - Bokningen blir Godkänd.
  - Kunden får ett mail (och notis) med en länk till tatuerarens kalender där hen bokar exakt så många tillfällen med den längden — bara lediga tider visas, upptaget i Google Calendar blockeras, och två kunder kan aldrig ta samma tid.
  - Bokade tillfällen syns i studions kalender och under kundens Bookings.

## Avvisa
- Rutan visar ett kommentarsfält ("Förklaring till kunden", valfritt men rekommenderat).
- Tryck "Avvisa och skicka": bokningen blir Avvisad och kunden får ett mail med studions förklaring.

## Tekniskt
- `ArtistBookings.tsx`: raderna blir klickbara och öppnar ny `BookingReviewDialog` (shadcn Dialog/Drawer). Bilder hämtas från bokningens kopplade filer/motiv (booking_files, projektets design) via signerade URL:er.
- Ny serverfunktion `approveBooking({bookingId, sessions, minutesPerSession})` (requireSupabaseAuth, kontroll att anroparen är bokningens artist): skapar eller återanvänder ett kundprojekt kopplat till bokningen, sätter sessioner via befintliga `setProjectSessions` och skickar länken via befintliga `sendSessionBookingLink` — samma kalender-, Google-synk- och dubbelbokningsskydd som idag.
- Ny serverfunktion `declineBooking({bookingId, comment})`: status cancelled + ny kolumn `decline_reason text` på bookings (nullable migration), mail via befintliga booking-status-mallen utökad med förklaringstext.
- AR-låset orört. Verifiering: typecheck, bun test, build och mobilvy-test av dialogen.
