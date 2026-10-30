# InkVision: ny startsida och städad kameravy

## 1. Try-on-menyn blir startsida

Startsidan (`/`) visar samma val som skärmavbilden från kameravyn, med:

- InkVision-logotypen högst upp
- Rubrik: "Start testing tattoos" (i stället för "Start your try-on")
- "Try a design" får en "Most popular"-markering och ny undertext:
  "Open free gallery and try in AR"
- Alternativet "Paste tattoo on a picture" tas bort ur listan
- Övriga val behålls: Upload picture, Text, AI creator, Sketch your own

Samma ändringar görs i kameravyns startvy så att de två ser likadana ut.

Dagens säljsida (rubriker, omdömen, "hur det funkar") flyttas till en egen
sida på `/about`, med länk från startsidan och foten. Den gamla adressen
behåller sitt innehåll via omdirigering så inget går förlorat i Google.

## 2. Förhandsgranskning efter bild och video

Video visar redan en granskning och behålls som den är. Fotogranskningen
visar i dag en svart ruta trots att bilden går att spara — den felsöks och
rättas så att det tagna fotot syns direkt efter avtryckaren, med samma
knappar som i dag (spara, dela, stäng).

## 3. Scan beta flyttas in i menyn

Den fristående "Scan beta"-knappen i kameravyns överkant tas bort. Funktionen
finns kvar under menyknappen, där den redan ligger som "Scan surface".

## 4. Tutorialen för nya användare

Den inlagda genomgången för nya användare visas inte längre — nya besökare
kommer direkt till valen på startsidan.

## Tekniska detaljer

- `src/routes/index.tsx`: ersätts av try-on-menyn (delad komponent), nuvarande
  landningsinnehåll flyttas till ny route `src/routes/about.tsx` med egen
  `head()`-metadata; `/` behåller sin egen titel/beskrivning.
- Ny delad komponent `src/components/TryOnStartMenu.tsx` används av både `/`
  och startvyn i `src/components/ARCamera.tsx` (rad ~2330) så texterna bara
  finns på ett ställe.
- Fotogranskning: felsök `composeStill()`/`captured`-flödet i `ARCamera.tsx`
  (sannolikt att canvas-komposition ger tom bild i förhandsvisningen medan
  delningsvägen komponerar om). Verifieras i förhandsvisningen.
- Ta bort "Scan"-knappen i top-raden (`ARCamera.tsx` ~rad 2672); menyposten
  "Scan surface" lämnas orörd.
- Tutorialen: `/onboarding/tour` slutar triggas automatiskt för nya användare.
- Lås- och spårningslogiken rörs inte alls.
