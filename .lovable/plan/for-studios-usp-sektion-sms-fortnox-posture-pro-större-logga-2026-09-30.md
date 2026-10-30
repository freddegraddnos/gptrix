# /for-studios: USP-sektion (SMS, Fortnox, Posture Pro) + större logga utan "skylt"-look

## 1. Loggan i hero (src/routes/for-studios.tsx)

- **Mycket större:** loggan fyller nästan hela innehållsbredden (ca 460 px mobil, ~900–1000 px desktop).
- **Bort med skylt-looken:** loggbilden har en svart platta med rundade hörn inbakad. I Dark mode blandas plattan bort med `mix-blend-mode: screen` så att bara märket och texten syns mot den svarta bakgrunden. I Bright mode vänds bilden med `filter: invert(1) hue-rotate(180deg)` (lila behåller sin kulör) så plattan smälter in mot det ljusa kortet.
- Nödvändig CSS läggs som utilities i `src/styles.css` (ingen hårdkodad färg i komponenten).

## 2. Ny sektion "Ingår i ditt abonnemang" / "Included in your plan"

Placeras direkt efter hero (före kapitelöversikten), utan nytt kapitelnummer. Tre stora kort med ikon, rubrik och löptext — varje kort får lila glöd i takt med övriga sidan:

- **SMS-aviseringar** — "Ny förfrågan? Du får SMS på direkten." Välj e-post, SMS eller båda; skicka ett test-SMS så du vet att det funkar. Du missar aldrig en kund, även när panelen är stängd.
- **Fortnox — bokföringen sköter sig själv** — Koppla din egen Fortnox med ett tryck. Depositioner, tatueringsbetalningar och motivförsäljningar bokförs automatiskt på de konton du väljer, och InkSimulators avgift registreras som kostnad. Spara tid och pengar på bokföringen — ingen manuell Avstämning i efterhand.
- **Posture Pro ingår** — "Värde 999 kr/år, utan extra kostnad." Enligt svensk lag och Arbetsmiljöverket måste du arbeta proaktivt med hälsomiljön på arbetsplatsen. InkSimulator hjälper er med det: Posture Pro ingår i abonnemanget och du loggar in med samma uppgifter som i studiopanelen.

## 3. Förstärka befintliga stycken

- **Kapitel 01 "Varför":** punkten "Partner med märke" behålls; en ny punkt tillkommer: "Bokföring & aviseringar ingår" (Fortnox + SMS kort) — totalt 5 punkter i rutnätet.
- **Kapitel 03 "Funktioner":** två nya kort: "Fortnox" (bokföringsikon) och "Posture Pro" (hjärt-/sköldikon, "Ingår — värde 999 kr/år").
- **Kapitel 08 FAQ:** två nya frågor:
  - "Ingår Posture Pro?" → Ja, värde 999 kr/år, ingår i abonnemanget. Svensk lag kräver proaktivt arbetsmiljöarbete; Posture Pro hjälper er komma igång.
  - "Kan vi koppla Fortnox?" → Ja, ett tryck i panelen. Betalningar och försäljningar bokförs automatiskt — sparar tid och bokföringskostnad.
- **/pricing:** abonnemangsavsnittet uppdateras: "Posture Pro ingår (värde 999 kr/år), SMS-aviseringar och Fortnox-koppling ingår" i båda språken.

## 4. Verifiering

- Playwright på 393, 754 och 1280 px, Dark + Bright samt SVE + ENG: loggan stor och utan synlig platta, sektionen syns, FAQ fungerar.
- Tsgo + build grönt.
