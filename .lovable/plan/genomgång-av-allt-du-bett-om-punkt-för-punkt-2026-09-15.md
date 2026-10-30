# Genomgång av allt du bett om — punkt för punkt

## Först: den dolda signup-sidan finns

Den ligger på **https://inkvision.app/adminsignup** (och samma adress i förhandsvisningen).

- Den är dold: inga länkar pekar dit och den är blockerad för Google.
- Den kräver en åtkomstkod. Koden är just nu **INKVISION-STUDIO** om ingen egen kod är satt.
- Kontot skapas direkt, **utan e-postverifiering**, studion blir godkänd på en gång och du hamnar direkt i studiopanelen.

Så den biten är gjord. Du behövde bara adressen.

## Vad jag gör nu: full revision av de senaste timmarnas beställningar

Jag går igenom hela vår historik från i går/natt och kontrollerar varje sak du bett om mot vad som faktiskt finns i appen. Ingen ny funktionalitet hittas på — bara kontroll, och åtgärd där något saknas eller gjorts fel.

### Områden som kontrolleras

1. Dold studio-signup utan e-postverifiering, och att vanliga studio-ansökningar fortfarande kräver ditt godkännande via mail med Godkänn/Neka.
2. Galleriet: pris/gratis, stil, namn vid uppladdning, sök, kategorier, köp och att köpta motiv syns hos både kund och studio.
3. Motiven: att vitt är borta även inuti, tight beskurna och rätt kategoriserade i bibliotek, Sleeve Builder och galleri.
4. Startsidan: att ett enda tryck räcker, inget dubbelklick.
5. AR: krysset för att ta bort motiv vid långtryck, och att det försvinner när man trycker utanför.
6. Kartan "Find your tattoo artist": riktiga studior, avståndsfilter, inget prisfilter, förfrågan till flera studior med neutral text i mailet.
7. Sleeve Builder: egna uppladdade, ritade, AI-genererade, köpta motiv och egna texter.
8. Rit- och textverktyg: utgång till menyn, Dafont-typsnitt, större och centrerad textruta.
9. Bokning: kalender, tidsförslag, deposition via Stripe, åldersverifiering, påminnelser och notiser.
10. Konto: "My account" på startsidan, automatisk inloggning på känd enhet, och att länkar från mail leder till rätt sida efter inloggning.
11. Instagram-koppling i studiopanelen.
12. Studions kundlista med redigering, döljning och avslut.

### Så här redovisas resultatet

Du får en lista i chatten: varje punkt markerad **Klar**, **Delvis** eller **Saknas**, med en rad om vad som återstår. Allt som är Delvis eller Saknas åtgärdar jag direkt i samma omgång, utan att du behöver be om det igen.

## Tekniska detaljer

- Genomgången sker mot koden (routes, funktioner, databasmigrationer och RLS-policys) plus stickprov i den körande appen med automatiserad mobilsimulering för de flöden som bara syns i gränssnittet.
- Åtgärder hålls minimala och riktade mot avvikelsen; inga omskrivningar av fungerande delar.
- AR-låset (OpenCV-spårningen) rörs inte.
- Efter åtgärder körs tester, typkontroll och bygge.
