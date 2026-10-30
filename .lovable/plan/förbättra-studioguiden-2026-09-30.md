# Förbättra studioguiden

## Resultat
- Nedersta kontaktfältet får tydlig rubrik, läsbar text och två synliga knappar i både Dark och Bright. Även språk- och temaval ska ha tydlig markering i båda lägena.
- Guidens åtta gamla skärmbilder ersätts med nya bilder från den aktuella sajten i dess lila profil. Varje bild beskärs runt den relevanta vyn så att innehållet går att se, i stället för att uppta en liten del av en stor svart bildyta. Bilder av privata paneler tas bara från verkligt åtkomliga vyer, utan påhittade data eller synliga personuppgifter.
- Sektionsnumren 01–08 och mindre stegnummer får en subtil lila skugga som harmonierar med startsidan.
- När man pekar på informationsrutorna byter även rubrik, beskrivning och nummer till kontrasterande färger, så att texten inte försvinner.

## Genomförande och kontroll
1. Fånga aktuella vyer av kundflöde och studioflikar i webbläsaren, beskär kring relevant innehåll och byt bildfilerna i guiden. Kontrollera att bildtexterna fortfarande beskriver det bilderna visar. Om någon skyddad vy inte kan öppnas utan ett tillgängligt studiokonto, ersätt inte den med en fabricerad skärmbild; redovisa vilka bilder som återstår.
2. Justera färgerna lokalt i `/for-studios`, utan att ändra AR, bokning eller andra sidor. Använd befintliga färgroller för båda temana och lila skugga för numren.
3. Kontrollera med mobil- och datorvy i Dark och Bright, inklusive knapptexter, hover-lägen och skärmbildernas läsbarhet.

## Tekniska detaljer
- Den nedersta rutan använder nu `bg-primary` men ärver textfärg från sidan; i Bright blir därför mörk text mot mörk bakgrund. Även dess sekundära knapp saknar explicit textfärg i Dark. Ge kontaktfältet och knapparna uttryckliga matchande förgrunds-/bakgrundsroller.
- Guidens bildreferenser finns i `src/routes/for-studios.tsx` och de gamla 1280×1800-bilderna ligger i `src/assets/guide/`; flera har en liten centrerad vy och stora tomma marginaler. Byt till riktiga, fokuserade fångster.
- Informationsrutorna under 01 har `hover:bg-primary` utan `hover:text-primary-foreground`, vilket gör texten oläslig i minst ett läge.
