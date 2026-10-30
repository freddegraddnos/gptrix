# Instagram-inloggning: kontroll mot Metas dokumentation

## Resultat av kontrollen
InkVisions Instagram-koppling följer redan dokumentet du skickade:
- Inloggningslänken skickar App ID, redirect-adress, `response_type=code`, behörigheter (`instagram_business_basic` + meddelanden) och en säker `state`-kod.
- Koden byts mot en token via `api.instagram.com/oauth/access_token`.
- Om studion trycker "Avbryt" skickas den tillbaka till studioinställningarna med ett tydligt meddelande.

## Liten förbättring
- Ta bort ett eventuellt avslutande `#_` från koden innan den byts mot token (skydd, enligt dokumentet).
- Visa svensk/engelsk text i studiopanelen när anslutningen avbröts, gick ut eller misslyckades.

## Det som saknas (bara du kan göra)
1. I Meta-appen: lägg exakt `https://inkvision.app/api/public/instagram/callback` som giltig OAuth-redirect (utan snedstreck på slutet).
2. Skicka "klar" så öppnar jag ett säkert formulär för App ID, App Secret och verify token.
3. Jag testar sedan kopplingen med din studio.

AR och övriga flöden rörs inte.
