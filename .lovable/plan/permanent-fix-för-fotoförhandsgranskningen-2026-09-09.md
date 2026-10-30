# Permanent fix för fotoförhandsgranskningen

## Mål
Efter ett tryck på fotoavtryckaren ska den tagna kamerabilden med tatueringen alltid visas högst upp i samma granskningsvy där delningsknapparna finns. Videoflödet lämnas orört.

## Genomförande
1. **Gör bildresultatet atomiskt**
   - Skapa den färdiga PNG-bilden och dess visningsadress innan granskningsvyn öppnas.
   - Spara bilddata, visningsadress och bildformat tillsammans, så panelen aldrig kan öppnas med en tom eller återkallad källa.
   - Flytta återkallning av gamla bildadresser ur Reacts state-uppdaterare till en säker cleanup när bilden stängs eller ersätts.

2. **Gör själva bildytan robust**
   - Ge fotot en bestämd mobilanpassad bildyta som inte kan kollapsa om bildladdningen tar tid.
   - Visa laddningsstatus tills PNG-bilden är avkodad.
   - Om den primära bildadressen misslyckas, byt en gång till den bevarade PNG-källan; visa ett tydligt fel i stället för en tom svart yta om även den misslyckas.

3. **Behåll exakt samma tagna bild i alla fotoåtgärder**
   - Förhandsgranskning, spara, dela och skicka ska använda samma komponerade foto med kamerabild och tatuering.
   - Ändra inte video, AR-låsning, tracking, HUD eller övriga delningsfunktioner.

## Verifiering
- Kör ett mobiltest med simulerad kamera: välj motiv, ta foto och kontrollera att en faktisk bild med både kamerabakgrund och tatuering syns ovanför delningsknapparna.
- Kontrollera i testet att bildytan har verklig höjd och att bildens pixlar inte är en tom/svart ruta.
- Stäng och ta ett nytt foto för att säkerställa att gamla bildadresser städas utan att den nya förhandsgranskningen förstörs.
- Kontrollera att video-preview fortfarande fungerar.
- Kör typkontroll, relevanta tester och kontrollera att appens byggstatus är grön.
