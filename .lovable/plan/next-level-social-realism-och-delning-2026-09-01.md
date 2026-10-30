# Next level: social, realism och delning

Uppdelat i fyra leveranser. Delning + foto-preview först, eftersom det direkt påverkar antalet delningar.

## Vad som redan finns (verifierat i koden)
- Bokmärken finns redan: `bookmarks`-tabell, `useBookmarks` (optimistisk UI, lokalt när utloggad) och `BookmarkStar`.
- Kopplade konton finns redan: `social_connections`-tabell, `ConnectedAccountsCard`, `ShareToConnected` för X, Facebook, Instagram, Snapchat, TikTok (användarnamnslänkning, inte OAuth).
- Foto-preview finns som `CaptureSheet` i AR-kameran; den öppnas efter avtryckaren, men det behöver felsökas varför den inte syns för dig.
- Vänfunktion saknas helt (bara `follows` finns).

## 1. Delning + preview efter foto (högst prio)
- Felsök varför preview-arket inte visas efter en tagen bild (darkroom-läge, z-index/HUD-fade under inspelning, eller att arket stängs direkt). Fix så previewen alltid visas.
- Ny preview-design: stor bild, tydliga knappar direkt under — Dela, Spara, Instagram Story, Snapchat, TikTok, Ny bild.
- Sociala mål blir synliga ikoner i första vyn i stället för att ligga i undermeny; format-preview (Story/Post/TikTok) behålls men flyttas upp.
- Samma synliga sociala rad i videoarket och i Lookbook-previewn.

## 2. Bokmärken — färdigställa
- ⭐ på varje motiv i galleri, in-camera-strip och feed (samma komponent överallt).
- Egen "Sparade"-vy med filter i Designs och en sektion på profilen.
- Bokmärkta motiv kan öppnas direkt i AR eller läggas i en collection.

## 3. Vänner + kopplade konton
- Nya tabeller `friendships` (pending/accepted/blocked) med RLS så bara berörda parter ser raden.
- Vänsida: sök på användarnamn, skicka/acceptera/avvisa förfrågning, vänlista.
- Inbjudan via delbar länk och SMS/Web Share (kontaktimport via telefonboken är inte tillgängligt för en webbapp/PWA — vi använder länk + användarnamnssök i stället).
- Vänner blir mottagare i matchande tatueringar och Couples, samt i delningsarket ("Skicka till vän").
- Kopplade konton: visa dem på profilen och i delningsarket som genvägar. Riktig OAuth för Instagram/Snapchat/X kräver godkända utvecklarkonton — vi förbereder datamodellen så den kan uppgraderas utan migrering.

## 4. AR-realism 2.0
Iterativ förbättring ovanpå befintlig OpenCV-pipeline (den byggs inte om):
- Ljus: utöka `lightEstimate` med riktningsuppskattning, inte bara nivå.
- Skuggor: mjuk skugga/inner-shadow som följer den uppskattade ljusriktningen.
- Hud: subtil kornighet, porstextur-blandning och lätt reflektionsdämpning så motivet inte ser ut som en dekal.
- Kurvatur: automatisk, ingen kroppsdelsväljare. Kameran uppskattar ytans form och vinkel direkt ur bilden (silhuettkanter, skuggradient över huden och rörelse mellan bildrutor) och bygger ett mesh av den — inte en fast generisk cylinder och inte ett manuellt val.
- Motivet "sticker upp": fixas genom att mesh:et projiceras med rätt perspektiv och normal, så kanterna böjs bort från kameran och motivet klipps mot hudens silhuett i stället för att flyta ovanpå.
- Kalibrerad 3D-scan används som mesh när den finns (då blir formen exakt).
- Kvalitetsläge: automatisk nedgradering på svaga enheter så bildfrekvensen hålls.


## 5. Snapchat som kanal
Ett Snapchat-lens byggs inte i den här appen — lenses skapas i Snaps eget Lens Studio och publiceras via ett godkänt Snap-utvecklarkonto. Det jag kan göra här:
- "Dela till Snapchat"-knapp som sparar bilden/videon och öppnar Snapchat (Creative Kit-klart flöde).
- Branded sticker/vattenmärke i Snap-vänligt format (1080x1920) med InkVision-märke och länk.
- Exportera motiv som PNG-assets + en färdig spec/checklista du kan ta rakt in i Lens Studio.
- Länkspårning så du ser hur mycket trafik Snapchat driver.

## Teknik
Nya tabeller `friendships` och ev. `collections` med GRANT + RLS scoped till `auth.uid()`. Realismarbetet sker i `src/lib/lightEstimate.ts`, `skinRealism.ts`, `bodyWrap.ts`, `limbCylinder.ts` och en ny mesh-modul; ingen förändring av lock/tracking-logiken. Delningsändringar i `ARCamera.tsx` (CaptureSheet/VideoSheet), `ShareHub.tsx` och `LookbookWall.tsx`.
