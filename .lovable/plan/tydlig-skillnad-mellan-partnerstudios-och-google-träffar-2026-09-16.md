# Tydlig skillnad mellan partnerstudios och Google-träffar

## Bakgrund

Inga studios har lagts in i databasen. Där finns bara två konton (ett testkonto och ditt eget). Allt annat du ser på kartan och i listan hämtas live från Google Maps offentliga företagsuppgifter varje gång sidan öppnas — inget sparas och ingen kontaktas.

Problemet är att de ser ut som anslutna partners och går att skicka bokningsförfrågan till.

## Vad som ändras

**Märkning**
- Varje studio som kommer från Google får en tydlig etikett: "Hittad via Google — ej ansluten".
- Partnerstudios (de som själva registrerat sig) får etiketten "Partner" och visas överst i listan.

**Knappar**
- För Google-träffar tas "Book" och kontakt-/förfrågningsknappen bort. Kvar blir "Vägbeskrivning", "Dela" och "Öppna i Google Maps".
- Detaljvyn för en Google-studio visar fortfarande foton, öppettider och adress (offentlig information), men utan "Skicka tatuering" eller bokning.
- Partnerstudios behåller allt: bokning, kontakt, galleri, profil.

**Text på sidan**
- En kort rad högst upp: "Studios märkta Partner är anslutna till InkVision. Övriga visas från Googles offentliga karta."

## Berörda ytor

Samma regler gäller på alla ställen där studios listas: kartsidan Studios, Studios-fliken under Community och studiosökningen.

## Tekniska detaljer

- `searchNearbyStudios` i `src/lib/studios.functions.ts` fortsätter returnera Google-resultat, men varje rad får ett fält `source: "google" | "partner"`.
- Server-funktionen matchar Google-träffar mot `artist_profiles` (på plats-id/namn+stad) och markerar de som faktiskt är anslutna som `partner`, så en registrerad studio inte dubbelvisas.
- `src/routes/studios.tsx`, `src/components/ArtistFinder.tsx` och `src/components/StudioDetailSheet.tsx` döljer boknings- och kontakt-CTA när `source === "google"`.
- Ingen databasändring och ingen radering behövs — inga studios finns lagrade.
