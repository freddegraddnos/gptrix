# Instagram DM: varje studio använder sitt eget konto

## Beslut
- En enda InkVision-app hos Meta (inte en app per studio).
- Varje studio kopplar sitt egen Instagram Business/Creator-konto via OAuth.
- Personliga Instagram-konton fungerar inte med DM-API:et.

## Vad som byggs
1. **Tydligare text i Studio-inställningarna**
   - Rubrik: "Connect your studio's Instagram"
   - Förklaring: "You log in with your own Instagram Business account. InkVision reads and replies to your DMs through a secure API connection."
   - Visa anslutet konto (användarnamn + avatar) eller "Not connected" + Connect-knapp.

2. **Hjälp-modal på samma sida**
   - "Do I need my own Meta app?" → Nej, InkVision hanterar API-anslutningen.
   - "Which Instagram account works?" → Business- eller Creator-konto kopplat till Meta Business Suite.
   - "What can I do from InkVision?" → Svara på DMs, omvandla chattar till projekt, skicka skisslänkar och tidsförslag.

3. **Varningar vid fel kontotyp**
   - Om anslutet konto inte är Business/Creator: visa "This Instagram account can't receive DMs via API. Switch to a Business or Creator account."
   - Om behörigheter saknas: visa "Reconnect Instagram and allow all requested permissions."

4. **Ingen per-studio app**
   - Behåll den centrala Meta-app-konfigurationen (app ID, secret, verify token) som du redan har på gång.
   - Lägg aldrig krav på studion att skapa eller hantera en egen Meta-app.

## Vad studion gör
1. Går till Studio settings → Instagram messages.
2. Klickar "Connect Instagram".
3. Loggar in med sitt egen Instagram Business-konto.
4. Godkänner behörigheter.
5. Klart — DMs börjar synas i Inbox.

## Tekniskt oförändrat
- AR-låset rörs inte.
- Befintlig `studio_instagram_links`, webhook, callback och Inbox-funktion behålls.
- Endast UI-text, varningar och hjälp läggs till.
