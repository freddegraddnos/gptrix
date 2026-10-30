# Fixa motiv på stillbild

## Mål
Motivet ska visas som en hel, tydlig tatuering på den uppladdade bilden – inte som streck eller ett trasigt mönster. Placering, storlek, rotation, böjning och sparad/delad bild ska fungera på dator, iPhone och Android. Live AR och AR-låset ska lämnas orörda.

## Genomförande
1. Återskapa felet i stillbildsvyn med samma typ av uppladdning och kontrollera om mönstret uppstår vid inläsning av motivet, när det ritas över fotot eller vid export. Kontrollera även byte mellan motiv och nya foton.
2. Rätta enbart stillbildsflödet. Om problemet ligger i dess WebGL-överlägg, byt stillbildens ritning till en tillförlitlig 2D-rendering utan att ändra den delade AR-motorn. Behåll användarens reglage och gester; hantera bildinläsningsfel och snabba byten så att ett gammalt eller trasigt motiv inte visas.
3. Låt förhandsvisning, sparad bild, delning och före/efter använda samma placering och färdiga bild, så att resultatet inte skiljer sig mellan skärm och export.

## Verifiering
- Prova uppladdning av stående och liggande foto, olika motiv, drag, storlek, rotation och böjning samt nytt foto på dator och mobilstorlekar.
- Kontrollera sparad/delad bild och före/efter mot vad som visas på skärmen, även efter snabba motivbyten.
- Kör relevanta tester och kontrollera typfel och byggstatus. Verifiera i tillgängliga webbläsare; verkliga iOS-/Android-enheter kan inte garanteras från utvecklingsmiljön och ska inte beskrivas som testade om de inte faktiskt används.