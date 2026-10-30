# Plan: fler typsnitt och textformer

## Resultat
Textgeneratorn får samma sökbara DaFont-katalog som ritverktyget och en tydlig meny för fyra textformer: vågrätt, lodrätt, båge och hel cirkel.

## Genomförande
1. **Koppla in det befintliga typsnittsbiblioteket**
   - Återanvänd ritverktygets befintliga DaFont-katalog, nedladdning och lokalt sparade typsnitt.
   - Visa installerade DaFont-typsnitt tillsammans med generatorns 18 fasta typsnitt.
   - Låt användaren söka, installera, välja och ta bort installerade typsnitt direkt från textgeneratorn.

2. **Lägg till menyn Textform**
   - Val: **Vågrätt**, **Lodrätt**, **Båge** och **Hel cirkel**.
   - Vågrätt visar texten som en vanlig rad.
   - Lodrätt staplar upprätta bokstäver uppifrån och ned.
   - Båge använder det befintliga kurvreglaget för en öppen båge.
   - Hel cirkel fördelar texten jämnt runt en komplett cirkel.
   - Menyn får tydliga 44 px tryckytor och följer sidans befintliga utseende.

3. **Rendera och spara samma form överallt**
   - Utöka den gemensamma textrenderingen så förhandsvisning, sparad transparent PNG och AR använder exakt samma valda textform.
   - Anpassa bildytan efter lodrät och cirkelformad text så inga bokstäver kapas.
   - Behåll bokstavsavstånd och typsnittsval där de är relevanta; kurvreglaget visas för båge.

4. **Verifiera utan att påverka andra verktyg**
   - Lägg deterministiska tester för vågrätt, staplad lodrät, båge och hel cirkel samt kontroll av bildens mått.
   - Kontrollera DaFont-installation och val i textgeneratorn på mobil och dator.
   - Kör berörda tester, typkontroll och byggkontroll.
   - Ritverktyget, AR-motorn och övriga flöden ändras inte.

## Tekniskt
- Befintliga `FontCatalogDialog` och `customFonts` återanvänds; inget nytt typsnittssystem skapas.
- Textformen läggs som ett uttryckligt renderingsval i den befintliga canvas-baserade `renderTextMotif`-funktionen.
- Ingen publicering ingår.
