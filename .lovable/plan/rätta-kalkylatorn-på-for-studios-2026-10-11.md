# Rätta kalkylatorn på For studios

## Diagnos (verifierad i koden)

- Själva uträkningen i `src/lib/studioTimeValue.ts` stämmer: 20 min × 5 kunder × 48 veckor / 60 = 80 timmar per år. Med 1 000 kr/timme = 80 000 kr/år. Med standardvärdet 800 kr/timme = 64 000 kr/år.
- Felet är förklaringstexten under "Så räknar vi" i `src/components/ForStudiosPage.tsx` (rad 172): den visar fortfarande den gamla månadsformeln `× 52 / 720`, som inte stämmer med den faktiska årsuträkningen.
- Standardtimpriset är 800 kr, inte 1 000 kr — därför visar kalkylatorn 64 000 kr/år som standard.

## Åtgärd

1. **Tilläggen räknas aldrig in automatiskt.** Stencil Maker, Fortnox och Leads är redan avstängda som standard och räknas bara in om studion själv slår på dem — det beteendet behålls och förstärks i presentationen: huvudsiffran utgår alltid från grunden (sparad tid per kund), och tilläggen presenteras tydligt som valfria tillägg som studion själv aktiverar om de passar (t.ex. om man inte redan använder annan stencilapp eller bokför via enskild firma). Inget tillägg får göra grundsiffran missvisande.
2. **Förklaringstexten** under "Så räknar vi" skrivs om så den visar den verkliga formeln per år:
   - Grund: kunder × minuter × 48 / 60 (timmar per år)
   - Stencil Maker: kunder × stencilminuter × 48 / 60
   - Fortnox: minuter × 12 / 60 (minuter per månad → timmar per år)
   - Leads: minuter × 12 / 60
   - Totalt: timmar × timpris = kr per år
3. **Kontroll mot ditt exempel:** test som verifierar att 20 min, 5 kunder/vecka, 48 veckor, 1 000 kr/timme ger exakt 80,0 timmar och 80 000 kr/år.
4. **Uppdatera testerna** i `tests/studioTimeValue.test.ts` med detta räkneexempel och kör dem.
5. **Visuell kontroll** av /for-studios och /sv/for-studios: siffran, timuppdelningen och förklaringen ska visa samma logik.

## Öppen fråga till dig

Standardtimpriset är i dag 800 kr. Ska standarden ändras till 1 000 kr/timme, eller behållas 800 kr? (Jag ändrar inget standardvärde utan ditt besked.)

## Ramar

- Ingen ändring av AR-motor, övriga sidor eller publicering.
- Endast kalkylatorns förklaringstext, tilläggens presentation, tester och — om du godkänner — standardtimpriset.
