# InkSimulate i Google och AI-sök

## 1. Namn, beskrivning och logga i Googles sökresultat
- Uppdatera företagsinfon som Google läser på varje sida: namnet InkSimulate, en kort beskrivning, adressen inksimulate.com och den nya InkSimulate-loggan (idag pekar den på den gamla InkVision-loggan).
- Lägg till uppgiften "sajtens namn" så Google visar **InkSimulate** i stället för adressen.
- Byt de allmänna standardtexterna (titel och beskrivning) så att de beskriver InkSimulate.
- Byt ikonen i webbläsarfliken och appikonen mot InkSimulate-märket.

## 2. Sajtkarta och Google Search Console
- Sajtkartan listar redan inksimulate.com. Jag tar bort privata sidor som inte hör hemma i Google (inloggning, profil, bokningar) och lägger till viktiga publika sidor (for-studios, photo-tryon, about, library).
- Efter publicering: lägg till och verifiera inksimulate.com i ditt anslutna Google Search Console-konto och skicka in sajtkartan där.

## 3. Så att AI kan hitta och förstå sidan
- Tillåt AI-sökmotorer (ChatGPT, Claude, Perplexity, Google AI) uttryckligen i robots-filen.
- Ny fil `/llms.txt`: en kort, lättläst sammanfattning av vad InkSimulate är, vad man kan göra och länkar till huvudsidorna. AI-verktyg använder den som en snabb introduktion.
- Startsidan får ett dolt stycke text som sökmotorer och AI kan läsa: vad appen gör (prova tatueringar i AR i skala 1:1, prova på foto, boka studio). Idag består startsidan nästan bara av knappar, så där finns lite text att förstå.
- Lägg till en strukturerad beskrivning av appen (webbapp, gratis att prova, funktioner) som Google och AI kan läsa direkt.

## 4. Google Business Profile
- Det finns ingen Google Business-koppling i ditt konto än. Jag visar en kopplingsruta. När du har kopplat kan jag uppdatera namn, beskrivning och webbadress på din företagsprofil, men **bara** om du redan har en profil. Loggan och bilderna laddar du upp själv i Google Business, eftersom den delen inte går att göra åt dig.
- Om du inte har någon profil behövs den inte för en webbapp. Då räcker punkt 1–3.

## Det du gör efteråt
- Publicera sajten. Google och AI-verktyg brukar hämta in ändringarna inom några dagar upp till några veckor.

## Tekniskt
- `__root.tsx`: JSON-LD `Organization` (id/url inksimulate.com, logo `/brand/`-PNG av InkSimulate-loggan, `sameAs`), `WebSite` med `name`/`alternateName`, standardmeta byts till InkSimulate. `index.tsx`: `SoftwareApplication`/`WebApplication` JSON-LD + visuellt dold `sr-only`-sektion.
- Favicon och ikoner genereras från InkSimulate-loggan (favicon.png, icon-192/512).
- `robots.txt`: explicita `User-agent`-block för GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended med `Allow: /`.
- `public/llms.txt` nyskapad. Sajtkartans lista justeras.
- Search Console: list sites → META-verifiering av `https://inksimulate.com/` om den saknas → submit sitemap.
- Google Business: `standard_connectors--connect google_business_profile`. PATCH via business_information med validateOnly först.
