# Fem separata delar — en i taget, ingen blandning

Jag delar upp din prompt i fem fristående delar. Del 1 är den tunga; 2–5 är avgränsade. AR-låset (spårningen) rörs inte i någon del.

---

## Del 1 — Varför motivet inte böjs efter beta-scanningen

### Vad jag hittade (verifierat i koden)

Scanningen mäter faktiskt fler saker än appen använder. Den färdiga scan-profilen innehåller krökning, riktning, lutning, bredd i cm, avsmalning (taper), ljusriktning och hudton.

Men själva böjningen av bilden görs av en enda funktion som bara tar emot **ett** tal: hur rund ytan är. Den böjer motivet symmetriskt, som runt en rak, jämntjock cylinder. Det betyder:

- Avsmalningen (armen är smalare mot handleden) används inte alls — motivet blir lika brett i båda ändar.
- Den uppmätta bredden i cm styr inte formen, bara storleken.
- Riktning och lutning roterar hela motivet som en platt dekal i stället för att förkorta och snedställa det.
- Böjen i en led (armbåge, knä) mäts av kameran men når aldrig fram till bildböjningen.
- Arbetet med mittaxel-kurvan och den cylindriska UV-mappningen från 3D-scanningen används bara i 3D-visaren, aldrig i AR-kameran.

Kort sagt: scanningen sparas, men bara ett av dess värden får forma motivet. Därför ser resultatet likadant ut med och utan scanning.

### Vad jag gör

Bygger ut böjningen så att den tar emot hela den uppmätta ytan i stället för ett enda tal:

1. **Avsmalning** — motivet trycks ihop mot den smala änden enligt uppmätt taper, så det följer armens form.
2. **Lutning** — den ände som lutar bort från kameran förkortas, så motivet ligger på ytan i stället för att stå rakt upp.
3. **Ledböj** — när kameran ser en böjd arm eller ett böjt ben bågas motivet längs böjen i stället för att brytas rakt över leden.
4. **Bredd i cm** — den uppmätta bredden avgör hur långt runt ytan motivet sveper, så ett brett motiv på en smal arm verkligen viker runt kanten.
5. **Synlig koppling** — när en scan används visas det i vyn, och ett enda tryck återställer till fri placering. Är scanningen osäker faller allt tillbaka på dagens beteende, aldrig något sämre.

Deterministiska tester på syntetiska former (rak tub, avsmalnande tub, böjd tub) säkerställer att böjningen följer måtten.

---

## Del 2 — Söka, boka och kontakta studior utan att ha tagit en bild

Idag leder nästan alla vägar till studior via kameran. Jag lägger till en egen ingång i Community:

- Ny flik **Studios** i Community, bredvid flödet.
- Sök på namn och stad, avståndsfilter, stilfilter — samma studiodata som kartan.
- På varje studio: **Message** och **Request booking** direkt, utan bild och utan tidigare projekt.
- Förfrågan utan bild fungerar fullt ut: placering, storlek, stil och beskrivning i text räcker. Bild blir valfri.
- Ej inloggad användare skickas till inloggning och kommer tillbaka till exakt samma studio efteråt.

---

## Del 3 — UI/UX-genomgång på mobil (iOS + Android)

Systematisk genomgång i riktig mobilsimulering, iPhone och Android, på de flöden som faktiskt används: start, kamera, galleri, community, bokning, konto.

Kontrolleras och åtgärdas:

- Knappar som hamnar under iPhones nedre streck eller Androids navigeringsfält.
- Områden där tangentbordet täcker inmatningsfältet.
- Knappytor mindre än tumstorlek, och tryck som kräver två försök.
- Sidor som skrollar i sidled eller hoppar när adressfältet döljs.
- Bilder som blinkar eller laddas om i onödan.
- Dialoger och paneler som inte går att stänga med svep.

Du får en kort lista över vad som var fel och vad som rättades. Rena skönhetsändringar utan problem bakom rörs inte.

---

## Del 4 — Flytta before/after, prank reactions och tattoo reveal till Community

De tre ligger idag som egna sidor utanför flödet och nås mest av en slump.

- De blir tre ingångar under en **Fun**-yta i Community.
- Gamla adresser fortsätter fungera och leder in i Community, så delade länkar inte dör.
- De tas bort från den utfällbara menyn så samma sak inte finns på två ställen.

---

## Del 5 — Google Calendar-åtkomsten

Kopplingen är faktiskt på plats: Google-klienten är kopplad till projektet, med långtidsåtkomst påslagen och rätt nycklar på servern. Det som saknas är alltså inte kopplingen i sig.

Det som återstår är på Google-sidan eller i själva godkännandet — typiskt att kontot inte finns med som testanvändare i Google-appen, eller att popup-fönstret blockeras i mobilwebbläsaren. Idag får du bara "Could not connect Google Calendar", vilket inte säger vilket av dem det är.

Jag gör därför:

1. Visar Googles egna felmeddelande i klartext i studiopanelen i stället för en allmän text.
2. Lägger till en test-knapp som kontrollerar kopplingen och visar vad som gick fel.
3. Rapporterar exakt vad Google svarar, så vi kan åtgärda rätt sak direkt — och lägger till en tydlig instruktion om popup-blockering på mobil.

---

## Tekniska detaljer

- Del 1: `src/lib/bodyWrap.ts` (`warpGeometry`/`wrapImageOnCylinder`) utökas med `taper`, `tilt`, `bendDeg` och `wrapFraction`; `ARCamera.tsx` matar in `SurfaceProfile` + `posePlacement().bendDeg`; cachenyckeln i `wrapImageOnCylinder` utökas med de nya parametrarna. Nya tester i `tests/`.
- Del 2: ny flik i `src/routes/community.tsx` som återanvänder `search_artists_v2` och befintligt request-flöde; bild görs valfri i förfrågningsformuläret.
- Del 3: Playwright mot dev-servern i mobilviewport, plus `env(safe-area-inset-*)`-kontroll i sticky/fixed-lager.
- Del 4: `/before-after`, `/reveal`, `/snapchat` behålls som routes och länkas från Community; borttagna ur `BottomNav`.
- Del 5: felutskrift från gateway/Google propageras genom `studioCalendar.functions.ts` till `StudioGoogleCalendarCard.tsx`.
- Inget i AR-låset (OpenCV-spårningen) ändras. Efter varje del: tester, typkontroll och bygge.
