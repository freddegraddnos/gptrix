# Plan: studiopriser, rätt mejladresser och ljust studioläge

## Resultat

1. Visa **299 kr/månad eller 2 999 kr/år** för studios på prissidan och i studioerbjudandet, på svenska och engelska. Visa **5 % provision på bokningar och motiv** och förklara att provisionen bidrar till kortavgifter och integrationer med vissa bokföringssystem. Uppdatera räkneexempel och motstridiga prisuppgifter i studioguiden och andra offentliga eller administrativa studiovyer. Hänvisa den som vill fråga eller ansluta sin studio till **+46 79 328 80 98**. Detta är prisinformation, inte ett nytt köpflöde; ange inte om moms ingår när det inte är fastställt.
2. Ändra provisionen för **nya** motivaffärer från 10 % till 5 % i både utbetalningsberäkning och bokföringsunderlag. Behåll tidigare registrerade affärers belopp och betalningshistorik; kontrollera att inga andra beräkningar fortfarande använder 10 %.
3. Säkerställ att boknings-, förfrågnings- och kundmejl till en studio går till just **den studions angivna e-postadress**, inte till 1891frs@gmail.com. Behåll 1891frs@gmail.com enbart för 1891FRS-kontots egna mejl; skilj studiospecifik kundkontakt från InkSimulators centrala kontakt och interna godkännanden.
4. Ordna **studios@inksimulator.com** som central kontaktadress med inkommande vidarebefordran till 1891frs@gmail.com och möjlighet att svara från Gmail **som studios@inksimulator.com**. Verifiera både inkommande provmejl och utgående svar innan centrala kontaktlänkar byts från Gmail-adressen och den tidigare varningen tas bort. Om domänens mejl-/DNS-inställningar eller åtkomst till Gmail kräver ägarens åtgärd, genomför allt som är möjligt och lämna de beroende stegen tydligt markerade; visa inte den nya adressen som fungerande i förtid. Ändra inte projektets redan verifierade avsändardomän för automatiska appmejl.
5. Lägg **Dark / Bright** bredvid språkvalet i studions panel på mobil och dator. Bright använder ljus bakgrund med mörk text och anpassade ytor, kanter och kontroller i både dashboard och guide. Valet sparas på enheten och påverkar inte kundsidor, motivens ljusa visningsytor eller AR-läget.
6. Kontrollera de två färglägena, språkvalet, priser och mejladresser i mobil- och datorvy; testa beräkningarna och de mejlflöden som går att prova utan extern domänåtkomst.

## Tekniska detaljer

- Prissidan och `/for-studios` innehåller i dag text om ingen månadsavgift och 10 % på motiv; utbetalningskoden och Fortnox-underlaget använder också 10 % för motiv. De befintliga `inkvision_monthly_sub`/`inkvision_yearly_sub`-priserna avser kundåtkomst, inte detta nya studiopris, och ska inte återanvändas.
- `artist_profiles.contact_email` används redan som första mottagare i flera studiospecifika meddelanden. Granska resterande vägar och behåll en säker studiospecifik reservväg om adress saknas; använd aldrig adminadressen som generell reserv för alla studios.
- Den befintliga avsändardomänen `notify.inkvision.app` är verifierad för appmejl. `inksimulator.com` saknar just nu MX-poster, så ett fungerande inkommande konto/vidarebefordran och verifierad Gmail-avsändare kräver separat mejlkonfiguration utanför appens vanliga utskick.
- Bright-läget avgränsas till studions arbetsyta med semantiska färgtoken och sparat val, inte en global invertering av hela sajten.
