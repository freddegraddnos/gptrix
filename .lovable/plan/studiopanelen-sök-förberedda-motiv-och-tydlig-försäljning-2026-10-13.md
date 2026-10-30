# Studiopanelen: sök, förberedda motiv och tydlig försäljning

## 4. "Vad vill du göra?"-sök
- Sökruta överst i studiopanelen (dator och mobil): "Vad vill du göra?" / "What do you want to do?".
- Söker i en lista över alla funktioner i panelen med namn, kort beskrivning och vanliga alternativa ord (t.ex. "meddelanden" ger Inkorg, SMS-aviseringar och E-postaviseringar). Klarar små stavfel och saknade å/ä/ö.
- Varje träff öppnar rätt flik eller sida direkt.
- Ingen träff: "Beskriv vad du försöker göra" med söktexten förifylld och redigerbar. Inget skickas förrän studion trycker "Skicka fråga". Bekräftelse: "Tack, vi har tagit emot din fråga." – inget löfte om att funktionen finns eller kommer byggas.
- Frågorna och missade sökord sparas så att vi kan se vad sökningen missar (ingen AI i första versionen).

## 5. Motivbild redo för digital provning
- Vid uppladdning av motiv visas: "Ladda upp själva motivet som en plan bild på vit bakgrund, utan perspektiv eller fotograferad hud." med en kort förklaring att det gör motivet lättare att visa på kroppen.
- Två bildexempel bredvid: "Bra" (plant motiv på vitt) och "Behöver anpassas" (foto av tatuering på hud i vinkel).
- Tydlig skillnad i texterna: **Motivbild** = den rena designen för digital provning (Motiv). **Utförd tatuering** = foto av färdigt arbete (Galleri). Galleriet får en rad som säger att bilderna där inte behöver fungera som motivbild.

## 6. Publicering, provning och försäljning
- Vid uppladdning väljer artisten tydligt mellan:
  1. "Visa motivet för att få kundförfrågningar" (gratis att prova digitalt, inget till salu).
  2. "Erbjud motivet till försäljning" (pris + villkor).
- Den ensamma märkningen "Free"/"Gratis" i butiken och på motivsidan ersätts med "Gratis att prova digitalt". Säljbara motiv visar pris och "Vad du köper".
- Vid försäljning skriver studion själv sina användningsvillkor (vad kunden köper och får göra). Ett motiv kan inte sättas till försäljning utan villkor. Villkoren visas för kunden före köp.
- Studions motivlista visar per motiv: "Visas för förfrågningar" eller "Till salu · pris".

## Tekniska detaljer
- Funktionsregister `src/lib/studioActions.ts` (nyckel, SV/EN-namn, beskrivning, synonymer, mål: flik/sida) + ren sökfunktion med normalisering och Levenshtein-tolerans; enhetstester (t.ex. "meddelanden" → tre träffar, "avisring" hittar aviseringar, ingen träff ger tomt).
- Komponent `StudioActionSearch` i StudioShell-presentationen; använder befintlig `onTabChange`/navigering, ändrar inte flikbeteendet.
- Ny tabell `studio_help_requests` (studio_id, query, message, created_at) med RLS: studion får lägga in och läsa sina egna; admin läser via befintlig rollkontroll.
- `marketplace_motifs`: ny kolumn `usage_terms text`; validering (trigger) att `price_ore > 0` kräver ifyllda villkor. Befintliga gratis-motiv påverkas inte; befintliga säljmotiv utan villkor visas med "Villkor saknas" för studion och kan inte köpas förrän villkor fyllts i – kontrolleras innan aktivering att det gäller få/inga rader.
- Två genererade exempelbilder i `src/assets/`. Köp-/betalflödet i övrigt oförändrat. SV/EN via `tx()`.
