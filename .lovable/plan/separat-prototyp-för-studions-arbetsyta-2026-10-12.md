# Separat prototyp för studions arbetsyta

## Mål
Skapa en fristående, granskningsbar prototyp med tydlig märkning att all information är exempeldata. Produktionspanelen, backend, sparade inställningar och AR lämnas helt orörda.

## Prototypens vyer
- **Idag:** ärenden som väntar på studions svar, nästa besök även när uppgiftslistan är tom, samt högst tre snabbval.
- **Statusmodell:** separata visuella statusar för designgodkännande, bokning och betalning, med en granskningsnot om hur de kan mappas till dagens faktiska statusar och vilka kopplingar som ännu saknas.
- **Bokningsinställningar:** fyra sammanfattningar för Formulär, Aviseringar, Tider och Assistent. Varje inställning har en enda huvudplats.
- **Formulär:** befintliga egna frågor presenteras utan att duplicera basfrågor om placering och storlek. Kundförhandsvisning visar ordning och obligatorisk/valfri.
- **Aviseringar:** studions förfrågningsaviseringar skiljs från kundens bekräftelser.
- **Tider:** öppettider, veckoregler och publicerade bokningsbara tider skiljs åt. En förhandsvisning visar datumintervall, antal tider och konflikter före en simulerad publicering.
- **Assistent:** grupperas i Uppdrag, Kunskap, Gränser och Kontrollera, med tydliga källor för priser/tider och skillnad mellan godkännande och direktbokning. Ett isolerat testläge använder bara exempeldata.

## Genomförande
- Lägg prototypen under en separat granskningsadress inom befintligt design-preview-område.
- Återanvänd det valda studiospråket, befintliga UI-komponenter och relevanta produktbegrepp, men anslut inte prototypen till riktiga data eller skrivande funktioner.
- Gör desktopversionen primär och säkerställ en tydlig mobilversion utan överlappning.
- Lägg en separat granskningssektion som redovisar återanvända funktioner, föreslagna nya funktioner och olösta datakopplingar.

## Kontroll
- Verifiera interaktioner, tomt Idag-läge, nästa bokning, statusåtskillnad, kundförhandsvisning och isolerat assistenttest.
- Kontrollera desktop och mobil visuellt och spara bilder för redovisningen.
- Kontrollera att inga nätverksanrop, riktiga bokningar eller meddelanden skapas från prototypen.
