# Studiopanelen: tydligare arbetsflöde och fungerande kundvy

## Mål
Gör studiopanelen till en lättnavigerad arbetsplats på dator, platta och mobil. Behåll InkSimulators svart/vitt/lila uttryck och befintliga funktioner. Layouten utgår från en konsultation med Anthropic Fable 5.1: viktigast först är dagens tider, saker att ta ställning till och missade händelser.

## Förändringar
1. **Vänstermeny hela vägen uppifrån och ned.** Gör nuvarande meny till en tydlig, fullhöjds knappmeny med aktiv markering och logisk ordning: Översikt, Bokningar, Kalender, Förfrågningar/Kunder, Skisser, Agent, Galleri & motiv, Ekonomi och Inställningar. Behåll befintliga undersidor och grupperingar; på mellanstora skärmar visas en smal ikonmeny med namngivna tips, på mobil behålls den snabbåtkomliga navigeringen och en komplett meny. Undvik dubbla eller otydliga ingångar.
2. **Översikten som arbetsyta.** Visa dagens bokningar och nya förfrågningar före sekundära genvägar. Gör rutan **Olästa aviseringar** klickbar till listan med missade notiser. Ge panelen en synlig notisknapp med antal olästa, återanvänd befintlig notislista och dess funktion för att markera läst och öppna rätt ärende. Hantera tomt läge och tangentbordsnavigering.
3. **Flytta ”Sell a design”.** Ta bort knappen från **Profil & utseende** och behåll den under **Motiv/Galleri**, där motsvarande uppladdningsväg redan finns. Ingen försäljningsfunktion ändras.
4. **Bakgrundsbild som faktiskt går att välja och se.** När **Bild** väljs, visa ett tydligt uppladdningsfält; visa vald bild direkt i förhandsvisningen, separat status för uppladdning och sparande, samt begripliga felmeddelanden. Spara bildvalet tillsammans med utseendet på ett förutsägbart sätt så att ett klart uppladdningssteg inte ser osparat eller fastlåst ut. Kontrollera befintliga filstorleks- och åtkomstregler, utan att ändra övriga bildflöden.
5. **Kundvy = studions publika sida.** Låt Kundvy öppna studions riktiga `/<studionamn>`-sida i förhandsvisning, inte kundens `/profile`. I Utseende ska den befintliga förhandsvisningen fortsätta spegla ändringar direkt, och en tydlig knapp ska öppna den publicerade studiosidan för kontroll. Om studion ännu saknar publik adress, visa ett begripligt inaktivt läge i stället för en felaktig länk.

## Tekniskt och kontroll
- Ändra i befintliga `StudioWorkspace`, `StudioOverview`, `StudioAppearanceEditor` och `artists.dashboard`; återanvänd notisvyn och studiosidans befintliga tema-/mediekomponenter. Behåll flikarnas id och beteende. Inga nya databastabeller eller ändringar av AR.
- Verifiera inloggat flöde i webbläsare: från olästa notiser till rätt lista och ärende, från Kundvy till studiosidan, samt välj/ladda upp/spara/öppna en bakgrundsbild. Kontrollera layout och klickytor på dator, 754 px platta och mobil. Kontrollera även den automatiska byggsignalen efter ändringarna.
