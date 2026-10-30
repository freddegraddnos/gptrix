# Startsidan tätare + inksimulate.com som huvuddomän

## 1. Mindre avstånd mellan loggan och "TRY IT BEFORE"
- Minska luften under loggan på startsidan (från ca 48 px till ca 24 px) så rubriken hamnar närmare.

## 2. inksimulate.com blir huvudadress överallt
Byt den gamla adressen inkvision.app mot https://inksimulate.com på alla ställen (ca 140 förekomster i ~70 filer):
- Alla sidors titlar/länkar för Google och delning (canonical, og:url), sitemap och robots.txt.
- Alla mail (bokning, påminnelse, studiogodkännande, meddelanden, inloggning) och SMS-länkar.
- Delningslänkar, kalenderfiler (.ics), PDF:er, videor/bilder med vattenmärke, studioguiden, integritetspolicy och villkor.
- Kalender- och betalningskopplingar som skickar tillbaka besökaren till sajten.

## 3. Behålls oförändrat
- ws.inkvision.app visar fortfarande pitch-sidan (egen adress, rörs inte).
- Adresser som redan är registrerade hos Meta/Instagram (redirect + webhook) och Google-verifieringen ligger kvar på inkvision.app tills du byter dem där — annars slutar de fungera. Jag listar vad du behöver uppdatera externt.
- AR-motorn rörs inte.

## Det du gör efteråt
- I Projektinställningar → Domäner: sätt inksimulate.com som **Primary** så att övriga adresser skickas vidare dit.
- Publicera sajten.

## Tekniskt
- `TryOnStartMenu.tsx`: `pb-12` → `pb-6`.
- Global ersättning `https://inkvision.app` / `inkvision.app` → `inksimulate.com`, utom `ws.inkvision.app` samt instagram callback/webhook-URL:er och Google OAuth redirect om de är registrerade externt (Google Calendar-redirect flyttas bara om du lägger till den nya i Google).
- Verifiering: rg utan kvarvarande träffar, tsgo, bun test 19/19, Playwright-skärmdump av startsidan.
