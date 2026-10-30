# Registrering, 18-årsgräns för bokningar och vita knappar

## Resultat
- Den som skapar ett konto anger en riktig e-postadress och kan frivilligt lägga till telefonnummer. En frivillig kryssruta ”Jag är 18 år eller äldre” visas tydligt. Förklara att kontaktuppgifterna används för aviseringar om bokningar, och att även yngre får skapa konto men inte skicka bokningsförfrågningar.
- Inloggning med användarnamn och lösenord fungerar fortfarande på samma enhet tills användaren loggar ut; redan skapade användarnamnskonton fortsätter fungera.
- Alla knappar med lila fyllning på andra sidor än startsidan blir vita med mörk text. Lila kan finnas kvar som accent i text, ramar och statusmarkeringar.
- Mobilflödena granskas och justeras där formulär, knappar, navigation eller innehåll inte får plats.

## Genomförande
1. Gör registreringslägena tydliga: användarnamn + lösenord + obligatorisk e-post + frivillig telefon och 18+-val. Använd riktig e-post för nya konton, behåll äldre kontons inloggningsväg, och se till att andra sätt att skapa konto inte hoppar över e-post och åldersinformationen. Befintliga profilfält för e-post och telefon används.
2. Spara 18+-svaret som en uppgift om användarens egen försäkran, inte som verifierad ålder. De som inte kryssade i vid registreringen, inklusive befintliga användare, kan bekräfta först när de vill skicka en bokning. De som anger att de är under 18 får behålla kontot och prova tatueringar, men inte skicka till studio.
3. Stoppa både direkta bokningar och förfrågningar till en eller flera studios för konton utan 18+-bekräftelse. Visa en tydlig spärr i respektive flöde och kontrollera samma villkor på serversidan/databasnivå så att det inte går att kringgå genom att hoppa över skärmen. Låt studions befintliga ID-kontroll inför ett faktiskt bokat tillfälle vara kvar som separat steg.
4. Inför semantisk vit knappfärg utanför startsidan och uppdatera även äldre knappar med explicit lila bakgrund, utan att ändra dekorativa lila ytor, väljare eller AR-låsets beteende.
5. Granska registrering, studioval, bokningsformulär, paneler och relevanta undersidor i smal mobilvy och på dator. Åtgärda påvisade överlappningar eller horisontell scroll; verifiera konto- och bokningsflöden, relevanta tester, typkontroll och förhandsvisning.

## Tekniskt
En ny profiluppgift håller den självdeklarerade 18+-bekräftelsen. Bokningstabellens insättning och serverfunktionerna för studioförfrågningar kontrollerar den inloggade användarens uppgift; öppna kalenderplatser får inte reserveras före samma kontroll. Befintliga användare tvingas inte igenom ny registrering. Vita knappar får ett eget semantiskt färgpar; startsidan behåller sin nuvarande formgivning.
