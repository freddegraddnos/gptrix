# Instagram-DM utan företagsverifiering: testarläge + "Svara i Instagram"-knapp

## Bakgrund
Metas fulla DM-API kräver företagsverifiering + App Review. Innan det är klart:
1. **Testarläge nu** — Meta-appen körs i Development mode; studios som läggs till som Instagram-testare kan ansluta och svara på DM via InkVision direkt.
2. **"Svara i Instagram"-knapp** — reserv för alla studios: öppna DM:n direkt i Instagram-appen.

Koden för OAuth, webhook och inkorgen är redan klar och rörs inte i grunden.

## Ändringar

### 1. "Svara i Instagram"-knapp i studioinkorgen
- I Instagram-trådar i `/artists/inbox`: knapp som öppnar `https://ig.me/m/<deltagarens-användarnamn>` i ny flik (öppnar Instagram-DM på mobil, profil på dator).
- Syns bara när deltagarens användarnamn finns (kommer från webhook-data).
- Tvåspråkig (SV/EN) enligt studiornas språkval.

### 2. Uppdaterad hjälptext i Instagram-kortet
- StudioInstagramCard: kort text som förklarar att under testfasen måste studioägarens Instagram läggas till som testare av InkVision (länk/instruktion), och att full åtkomst kommer när Metas granskning är klar.

### 3. Verify token: säker formulärbytes
- Nuvarande sparade token är för kort (2 tecken) och hade inte accepterats av Meta.
- Öppnar säkert formulär där du klistrar in `inkvision_meta_webhook_2026` — samma sträng ska sedan stå i Meta → Webhooks → Verify token.

### 4. Publicera och verifiera
- Publicera så Facebooks domänverifieringstagg (redan inlagd) syns på inkvision.app → tryck sedan "Verifiera domän" i Meta.
- Testa webhook: `GET /api/public/instagram/webhook` mot publicerad URL ska svara med challenge när token stämmer.
- AR-motorn, bokningar, betalningar och övriga flöden rörs inte.

## Vad du gör i Meta (ca 10 min)
1. **Domänverifiering:** klistra in `inkvision.app` + `www.inkvision.app`, tryck Verifiera (taggen publiceras av oss).
2. **Webhooks:** Callback URL `https://inkvision.app/api/public/instagram/webhook`, Verify token `inkvision_meta_webhook_2026`, prenumerera på `messages`.
3. **Instagram login:** Redirect URI `https://inkvision.app/api/public/instagram/callback`.
4. **Testare:** App roles → Instagram testare → lägg till studios Instagram-användarnamn (de accepterar inbjudan i Instagram-appen: Instagram → Inställningar → Webbsida och appbehörigheter → Inbjudningar).
5. Studior ansluter sedan som vanligt via panelen under Profil → "Connect your studio's Instagram".
