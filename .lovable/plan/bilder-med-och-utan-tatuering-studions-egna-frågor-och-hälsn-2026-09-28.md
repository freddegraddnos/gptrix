# Bilder med och utan tatuering + studions egna frågor och hälsning vid bokning

## Del 1 — Tatueraren får två bilder: med och utan AR-motivet

Idag sparas bara bilden *med* motivet. Så här blir det:
- När kunden sparar en provning (foto eller Live AR) sparas två bilder: samma bild med tatueringen och utan tatueringen.
- På fotoprovningen läggs en knapp till, "Spara och boka", som sparar båda bilderna och öppnar bokningen direkt.
- När kunden bokar och väljer sin sparade provning följer båda bilderna med.
- I bokningsrutan i studiopanelen visas bilderna sida vid sida, märkta "Med tatuering" och "Utan tatuering". Du kan trycka på en bild för att förstora den.
- Kunden kan också ladda upp egna bilder direkt i bokningsformuläret, om hen inte har någon sparad provning.

## Del 2 — Studions egna frågor och hälsning

**I studiopanelen** (under Profil, ny ruta "Bokningsformulär"):
- Du skriver en hälsning som skickas till kunden, t.ex. "Tack för din förfrågan! Vi svarar inom 48 h."
- Du lägger till egna frågor, upp till 10 st, t.ex. "Har du tatueringar sedan tidigare?" eller "Allergier?". Varje fråga kan vara ett fritextsvar eller ja/nej, och kan markeras som obligatorisk.
- Du kan ändra ordningen på frågorna, redigera och ta bort dem. Förhandsvisning av hur kunden ser formuläret.

**Hos kunden:**
- Frågorna visas i bokningsformuläret. Obligatoriska frågor måste besvaras innan kunden kan skicka.
- Direkt efter bokningen får kunden ett mail med din hälsning, sina svar och en sammanfattning av bokningen.

**Hos dig:**
- Kundens svar visas i bokningsrutan under kundens uppgifter, och följer med i mailet/SMS:et om den nya förfrågan.

## Tekniskt
- Migration: `projects.base_photo_url` finns redan och används för den rena bilden. Nya kolumner: `bookings.base_photo_url text`, `bookings.intake_answers jsonb`, `artist_profiles.booking_greeting text`, `artist_profiles.booking_questions jsonb default '[]'`. Alla nullable eller med default, så inget befintligt påverkas.
- `saveProject` får `basePhotoDataUrl` och laddar upp den ren bilden på samma sätt som förhandsbilden. Fotoprovningen skickar in originalbilden. Live AR skickar kamerabilden utan överlägg, som redan tas vid fotot. Det är en ändring som bara rör sparandet, i spar-anropen i ARCamera. Spårning, lås och rendering rörs inte, och de 19 stabilitetstesterna ska passera.
- `getBookingReview` rättas så den läser `preview_url` (med tatuering) och `base_photo_url` (utan tatuering) från projektet, och returnerar bilderna märkta.
- Frågor och hälsning läses publikt via en ny SECURITY DEFINER-funktion `studio_booking_form(_studio uuid)`, som bara returnerar hälsning och frågor. Svaren valideras server-side mot studions frågor.
- Mailet till kunden använder den befintliga mallen `booking-status` (status "requested"), utökad med hälsning och svar. Tatuerarens mail och SMS om ny förfrågan får svaren bifogade.
- UI på SV/EN enligt språkvalet i studiopanelen. Kundsidan är på engelska.
- Verifiering: typecheck, bun test 19/19, build och test i mobilvy av bokningen och studions bokningsruta.
