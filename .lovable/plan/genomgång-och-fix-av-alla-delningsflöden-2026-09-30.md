# Genomgång och fix av alla delningsflöden

## Mål
Alla sätt att dela ska fungera på mobil (iPhone + Android): Snapchat, röstlänk (Vote), Reaction cam, bilddelning, spara i kamerarullen, nedladdning, länkdelning (WhatsApp, Messenger, SMS m.fl.), delning av motivlänk till AR, stickers/Lens-paket på Snapchat-sidan och delade förhandsvisningar (p/, s/, v/).

## Kända symptom
- Snapchat visar "Fel när bilden skulle laddas".
- Varken Vote-länk eller Reaction cam-länk går att skapa.

Orsaken är inte bekräftad än — steg 1 är att återskapa felen och läsa exakta felmeddelanden.

## Steg
1. **Återskapa varje flöde** i en testwebbläsare (inloggad) och logga exakta fel från appen och servern: skapa vote-länk med bild och med video, reaction-länk, öppna länken som gäst, rösta, spela in reaktion, och alla knappar i delningspanelen och på Snapchat-sidan.
2. **Vote / Reaction**: rätta det som faktiskt stoppar skapandet. Troliga kandidater att kontrollera: för stor fil som skickas i ett anrop (bilden/videon skickas som text, kan överstiga gränsen), uppladdningsgräns i lagringen, åtkomstregel för bilduppladdning, eller att länken inte kan läsas som gäst. Laddas vid behov upp direkt från telefonen i stället för via ett stort anrop, och bilder komprimeras till JPG innan uppladdning.
3. **Snapchat**: se till att filen som lämnas över är en vanlig JPG/PNG i rimlig storlek (inte WebP eller jättestor), med korrekt filtyp och namn, och att appen öppnas först efter att bilden sparats/delats. Samma kontroll för Instagram och TikTok.
4. **Övriga flöden**: kontrollera att dela-knappen faller tillbaka till nedladdning/kopiera länk när telefonen inte stödjer delning, att inga fel sväljs tyst, och att tydliga svenska/engelska felmeddelanden visas i stället för generiska.
5. **Delade sidor**: öppna vote-, reaction- och förhandsvisningslänkar utloggad och kontrollera att bild/video laddas och att röst/reaktion sparas.
6. **Verifiera** varje flöde igen efter fix, och att AR-testerna fortfarande går igenom.

## Påverkas inte
AR-motorn och AR-låset rörs inte.

## Tekniskt
- Filer: `src/components/ShareHub.tsx`, `src/lib/share.ts`, `src/lib/votes.functions.ts`, `src/routes/snapchat.tsx`, `src/routes/v.$slug.tsx`, `vote-results.$slug.tsx`, `p.$token.tsx`, `s.$token.tsx`, `LiveTryOn.tsx`, `videoRecording.ts`.
- `createVoteSession` tar emot base64 upp till 40 MB i request-body → sannolik gräns; alternativ: klientuppladdning till bucket `votes` (policy `owner = auth.uid()` finns) och skicka `path`.
- Kontrollera bucket `votes` filstorleksgräns och gäst-läsning via signerade URL:er.
- Delning: `shareFile` gör `File` med `blob.type`; tvinga `image/jpeg`/`image/png`, begränsa till ~2048 px.
