# Studiosökningen enligt bild 11

Nästa del i förslaget: omgörning av `/studios` från "karta först" till "sök + lista först, karta som alternativ" (bild 10 → bild 11). Byggs i ett separat utkast — inget publiceras. Övriga sidor, AR, motorer och data röras inte.

## Status enligt dokumentet (03-tidigare-kundforslag.md)

- Skapa (bild 07): klart i utkast.
- Motivbibliotek (bild 09): klart i utkast. Kvar därifrån: bild 16 — skilj på laddning, nätverksfel och noll träffar, och ge en tydlig rensa/återställ-handling i nolläget. Liten komplettering som ingår här.
- Studiosökning (bild 10–11): denna plan.
- AR-menyn (bild 12–14): nästa steg efter detta.
- Bild 15 (motivförhandsvisning före AR): separat beslut, inte påbörjat.

## Ny layout för /studios (enligt bild 11)

- **Rubrik:** kickertext "INKSIMULATOR STUDIOS", stor Anton-rubrik "FIND YOUR STUDIO", underrubrik "A place for your next tattoo."
- **Sökfält:** "Studio name or city" (befintlig söklogik `search_artists_v2` återanvänds, med debounce).
- **Platsval:** två val "All locations" / "Near me". "Near me" kräver aktivt platsval; nekad plats ger ett tydligt meddelande men blockerar inte manuell sökning. Inga påhittade avstånd.
- **Visningsväxel:** List / Map (segmenterad kontroll). Kartan (befintlig Leaflet-karta) visas endast i Map-läge; List är standard.
- **Filters-knapp:** befintliga filter (stil, avstånd, betyg) bevaras och öppnas som tidigare.
- **Studiokort i lista:** studionamn, stad · adress, godkännandestatus ("Approved studio") hämtat från befintliga godkännandefält (artist_profiles status + approval_status, båda approved), och "Explore studio →" som öppnar befintlig detaljvy. Betyg, stilar och Contact/Book-knappar bevaras.

## Vad som bevaras

- Multi-select-flödet (välj flera studios → skicka förfrågan till /boka/multi).
- Contact (meddelande) och Book (BookingDialog) på varje kort.
- StudioDetailSheet, StudioWaitlist (noll träffar → närmaste studio + städer), error-läge.
- Kartan med StudioLeafletMap i Map-läget, inkl. val av studio på kartan.
- Endeavor: partnernearby-listan (searchNearbyStudios) visas i Map-läget som idag; listan visar godkända InkSimulator-studios först.

## Bibliotekets komplettering (bild 16)

I `/library` nolläget: lägg till en tydlig "Clear search & filters"-knapp som nollställer sökning och stilfilter. Nätverksfel visas som eget läge (från marketplace-hookens fel) med "Try again" — åtskilt från "None in this style yet".

## Ramar

- Ändringar endast i `src/routes/studios.tsx` och `src/components/ArtistFinder.tsx` (plus små hjälpkomponenter vid behov) och `src/routes/library.tsx` för bild 16-kompletteringen.
- Svart/vitt/violett tema, Anton + DM Mono, violetta ytor/skuggning enligt referensen. Mobil först, 44 px tryckytor.
- Verifiering: typecheck, build-logg, Playwright på mobil (390 px) och desktop (1280 px) — sök, platsval, List/Map-växel, filter och kortklick (detail/book/contact) testas. Fysisk mobil, tangentbord, fokus och fel-/tomlägen kontrolleras.
- Ingen publicering — utkastet godkänns av Fredrik först.
