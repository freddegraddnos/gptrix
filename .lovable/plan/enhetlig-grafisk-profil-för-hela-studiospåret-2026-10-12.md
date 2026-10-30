# Enhetlig grafisk profil för hela studiospåret

## Bekräftad avvikelse mot referensbilden
- Nuvarande `/for-studios` är mycket plattare och mörkare än referensen: den blåvioletta bakgrundstoningen är nästan borta, huvudrubriken har för liten optisk vikt och den vita huvudknappen följer inte referensens violetta uttryck.
- Referensen använder en sammanhållen nära-svart yta med en kontrollerad blåviolett ljuszon, vit Anton-rubrik med skarp svag glöd, DM Mono i gränssnittet, violetta valmarkeringar och tunna violetta konturer.
- `/studio-guide` använder samma grund men har för stark flerstegs-glöd på rubriken ”Så fungerar InkSimulator i din studio”.
- `/studio-guide/setup` ligger redan nära rätt profil och ska vara visuell bas, inte byggas om.
- Studioinloggningen och den inloggade studiopanelen använder idag närliggande färger och typsnitt men saknar exakt samma bakgrundsatmosfär, ytor, konturer och rubrikbehandling.

## Genomförande
1. Skapa en gemensamt avgränsad studioprofil i de befintliga designstilarna: nära-svart bakgrund, lugn blåviolett fade, `#8A5BF2`-accent, Anton för rubriker, DM Mono för brödtext och kontroller, tunna diskreta violetta konturer och återhållen glöd.
2. Applicera endast denna presentation på svenska och engelska versioner av:
   - `/for-studios`
   - `/studio-guide`
   - `/studio-guide/setup`
   - studioinloggningen (`/artists`, `/sv/artists` och den befintliga äldre omdirigeringen)
   - `/artists/dashboard` och samtliga studioundersidor som använder den gemensamma `StudioShell`/`StudioWorkspace`-ramen.
3. Matcha `/for-studios` mot referensens visuella styrka utan att återinföra gammalt innehåll: behåll nuvarande rubrik, kalkylator, årsberäkning, sektioner och knapparnas destinationer; ändra bara färg, ljus, kontur, typografisk skala och ytors visuella behandling.
4. Minska glöden specifikt på ”Så fungerar InkSimulator i din studio” till en skarp, svag violett kantglöd. Behåll setup-guidens struktur och innehåll oförändrade.
5. Ge login och panelens gemensamma ram samma bakgrund, rubrikbehandling, kort-/fält-/menyytor och valmarkeringar. Behåll Dark/Bright, och låt Bright fortsätta fungera utan mörka specialeffekter.
6. Lämna varje sidas text, innehållsordning, länkar, destinationsadresser, navigation, flikar, URL-synk, formulär, data, behörigheter, integrationer och affärslogik exakt som de är.

## Avgränsning
- Ingen AR-, kamera-, rit-, spårnings- eller renderingskod berörs.
- Inga nya länkar, menyval, sektioner, funktioner, texter eller förslag läggs till.
- Referensbilderna används endast som visuell jämförelse och läggs inte in på sidan.
- Ingen publicering.

## Kontroll
- Jämför före/efter mot referensen på `/for-studios` vid 390 px och 1440 px.
- Kontrollera `/studio-guide`, `/studio-guide/setup`, studioinloggning och representativa panelvyer på 320, 390 och 1440 px.
- Kontrollera Dark/Bright, svenska/engelska, större text, fokusmarkeringar och att inget överlappar eller klipps.
- Kontrollera befintliga länkar, flikar och returvägar utan att ändra dem, samt att bygget är felfritt.
