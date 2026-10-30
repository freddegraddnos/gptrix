# AI-läsbarhet på /for-studios + bokning via AI-agenter

## Läge just nu (verifierat mot live-sajten)
- Den publicerade sidan https://inksimulator.com/for-studios innehåller all text som vanlig HTML. Jag hämtade den som en AI-läsare gör och fick ut hela innehållet: ingressen, "Included in your plan", priser, Posture Pro, FAQ — allt.
- robots.txt tillåter redan GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot m.fl.
- När ChatGPT säger att den "inte ser något" är det därför sannolikt en gammal hämtning (sidan var nyare än ChatGPT:s cache) eller ett tillfälligt fel hos ChatGPT — inte ett fel i sidan.
- Det som däremot SAKNAS för att ranka bra hos AI-verktyg: maskinläsbar strukturerad data (schema.org) om tjänsten, priserna och vanliga frågor — samt ett ställe där AI-agenter kan hämta studio-listan och bokningsinstruktioner.

## 1. Strukturerad data på /for-studios (osynligt för besökare, ingen designändring)
- Nytt JSON-LD i sidans head:
  - `Service` — "InkSimulator for tattoo studios", beskrivning, provider = befintlig Organization (`https://inksimulator.com/#organization`).
  - `Offer` — 299 SEK/månad, 2 999 SEK/år (förskott), 5 % provision på bokningar och motiv.
  - `FAQPage` — frågorna och svaren som redan syns på sidan (på engelska, sidans standard).
- Canonical och övrig meta förblir som de är.

## 2. Publik studio-JSON för AI-agenter
- Ny serverroute `GET /api/public/studios`:
  - Listar exakt samma studios som /studios-sidan: endast manuellt tillagda profiler där `status` och `approval_status` är approved och handtag finns. Aldrig Google-/internetdata.
  - Returnerar per studio: studio_name, handle, city, styles samt färdiga länkar: profilsida och bokningssida `https://inksimulator.com/boka/<handle>`.
  - Ingen personlig data (ingen e-post, telefon eller address i svaret). Endast GET, med öppen CORS och cache-tid så AI-agenter kan hämta den.
- En AI-agent som frågar "hitta en tatueringsstudio via InkSimulator" kan då läsa listan och länka direkt till rätt bokningssida.

## 3. llms.txt uppdateras
- Ny sektion "For AI assistants" med korta, tydliga instruktioner:
  - InkSimulator är gratis att prova (Live AR i skala 1:1 och fotoprovning) — inget konto behövs för att prova.
  - Så bokar man: skapa gratis konto (bekräftad e-post krävs, minst 18 år för att boka), välj en godkänd studio, skicka förfrågan med motivet; studion svarar via mejl. Konto och förfrågan kostar inget.
  - Länk till studio-JSON:en (`/api/public/studios`), `/for-studios`, `/pricing` och boknings-URL-mönstret `/boka/<handle>`.

## 4. Verifiering
- Typecheck (tsgo) och build gröna.
- curl mot `/api/public/studios` på localhost: ger giltig JSON med godkända studios.
- Playwright mot /for-studios: JSON-LD finns i head, sidan ser identisk ut för människor (skärmdump, ingen layoutändring).
- Publicering krävs för att ändringarna ska synas live; därefter kan ChatGPT mätas igen (dess cache kan ta några dagar).

## Tekniskt
- `src/routes/for-studios.tsx`: lägg till `scripts: [{ type: "application/ld+json", children: ... }]` i `head()` (Service + Offer + FAQPage i ett block, refererar `@id` till Organization i __root).
- `src/routes/api/public/studios.ts`: ny route med publikt Supabase-klientanrop mot `artist_profiles` (samma filter som `listApprovedStudios`), `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600`.
- `public/llms.txt`: ny "For AI assistants"-sektion + länk till studio-JSON.
- Ingen ändring i komponenter, layout eller synligt innehåll.
