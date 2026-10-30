# /for-studios i nya grafiska profilen

## Vad du får
- Sidan får samma utseende som studio-dashboarden: svart bakgrund, vita/lila detaljer, samma typsnitt och kort i stället för dagens pappers-/beige-stil.
- Uppe till höger: samma två växlare som i dashboarden, bredvid varandra: **ENG | SWE** och **Dark | Bright**.
- Språk: engelska som standard, svenska om webbläsaren är svensk; ditt val sparas (som idag).
- Dark/Bright: Bright ger ljus bakgrund med mörk text, precis som i dashboarden. Valet delas med dashboarden, så väljer man Bright på ena stället gäller det även på det andra.
- Texter, bilder, prislänk, telefonkontakt och innehåll ändras inte — bara utseendet.

## Tekniska detaljer
- `src/routes/for-studios.tsx`: byt `bg-paper`/`text-paper-ink`/`border-paper-ink` (27 ställen) och `bg-ink`-sektioner mot semantiska tokens (`bg-background`, `bg-card`, `text-foreground`, `border-border`, `text-primary`).
- Återanvänd `useStudioTheme()` (samma lagringsnyckel) och lägg `studio-bright`-klassen på sidans `<main>`, så befintliga Bright-regler i `styles.css` gäller.
- Bryt ut dashboardens språk- och temaväxlare från `StudioWorkspace.tsx` till en delad komponent `StudioPrefsSwitch` och använd den i både dashboarden (samma beteende) och /for-studios. Språket på /for-studios fortsätter använda `usePublicStudioLang`.
- Verifiera med Playwright på 393 px och 1280 px i Dark och Bright, ENG och SWE.
