# Rätta studiopanelens fyra avvikelser

## Bekräftat nuläge
- Dark/Bright finns, men är gömt i kontomenyn bakom studionamnet. Det finns också under **Inställningar → Språk & tema**. Det är därför inte synligt som ett normalt reglage i dashboarden.
- Den inloggade panelens gemensamma ram visar endast studions namn. InkSimulators befintliga logotyp används inte i vänsterhörnet.
- Det finns en riktig studiosida under **Studiosida → Profil & utseende**, som sparar till den publika sidan. Den andra är `/design-preview/studio-builder`, en isolerad prototyp som varken sparar eller publicerar. Studion behöver alltså inte fylla i dubbelt i nuläget, men två separata gränssnitt ger fel intryck och prototypens godkända funktioner är inte kopplade till den riktiga sidan.
- Bokningsagenten är avstängd som systemstandard. Kontot **1891frs** har däremot en sparad aktiv inställning med direktbokning och timpris. Enligt ditt val behålls detta konto aktivt.

## Genomförande

### 1. Synligt tema och korrekt logotyp
- Lägg den befintliga officiella InkSimulator-logotypen i panelens vänstra överkant på dator.
- Visa samma logotyp kompakt i panelhuvudet på mobil och surfplatta utan att tränga undan Kundsida eller kontomenyn.
- Lägg ett synligt Dark/Bright-reglage i den gemensamma panelramen på alla bredder. Det använder samma sparade val som idag.
- Behåll **Språk & tema** och kontomenyn som alternativa vägar; inga befintliga inställningar eller språkval tas bort.

### 2. En enda riktig studiosidebyggare
- Gör **Studiosida → Profil & utseende** till den enda arbetsplatsen för den publika studiosidan.
- Samla den under de godkända rubrikerna **Innehåll, Utseende, Undersidor och Förhandsvisning**.
- Använd endast befintliga verkliga källor:
  - studiouppgifter från den nuvarande profilen
  - arbetsprover från det befintliga offentliga galleriet
  - artistpresentationer från **Artister på studiosidan**
  - tjänster/priser från befintliga tjänster
  - kontakt, bokning och agentstatus från dagens inställningar
- Flytta in de godkända byggarkontrollerna i den riktiga sidan: Portfolio/Studio/Personligt, omslag, utseende, egna undersidor/externa länkar och mobil-/datorförhandsvisning.
- Återanvänd samma sparade innehåll när stilpaket byts. Skapa inga parallella studio-, artist-, galleri- eller tjänsteposter.
- För kontroller som ännu inte har egen kolumn, spara presentationen i den befintliga `theme`-inställningen på studioprofilen och låt den publika sidan läsa samma värden. Ingen ny dubblettabell skapas.
- Behåll tydligt att sparande uppdaterar den publika sidan direkt för en publicerad studio. Lägg inte till ett falskt utkasts- eller publiceringsflöde.
- Låt den gamla granskningsadressen leda till den riktiga byggaren så att två konkurrerande studiosidor inte längre presenteras.

### 3. Bokningsagenten som tydligt valbart stöd
- Behåll agenten aktiv för **1891frs**, inklusive nuvarande sparade direktboknings- och prisinställningar.
- Märk Bokningsagent som **Valfritt stöd** i dashboard, meny och inställningsvy.
- Visa först ett tydligt aktivt/avstängt läge och en uttrycklig knapp för att slå på eller av. När agenten är av visas inte resten som om den måste konfigureras.
- När agenten är aktiv visas dess befintliga pris-, tids-, kunskaps- och godkännandeinställningar oförändrade.
- Ändra inte systemstandarden: nya eller oinställda studios har agenten av och godkännande före bokning som säkert grundläge.

## Avgränsning
- Ingen AR-, kamera-, rit-, spårnings- eller renderingskod ändras.
- Inga kunddata, behörigheter, bokningar, betalningar eller meddelanden ändras eller skapas.
- Dashboardens nuvarande huvudgrupper, destinationer och tabbnavigation behålls.
- Ingen publicering.

## Verifiering
- Kontrollera logotyp och synligt Dark/Bright-reglage på 320, 390, 754 och 1440 px, inklusive Bright-läge och tangentbord.
- Kontrollera att Profil & utseende läser befintliga uppgifter, galleri, artister och tjänster utan dubbletter.
- Ändra endast ofarliga presentationsvärden i testsessionen och kontrollera förhandsvisning mot den riktiga publika sidan; återställ efter kontroll.
- Kontrollera att den gamla prototyplänken inte längre skapar en andra arbetsplats.
- Kontrollera att 1891frs fortfarande har agenten aktiv och att en studio utan aktiv inställning ser agenten som avstängd och valfri.
