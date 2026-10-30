# Publicera nya studiosidan — behåll den gamla som fördjupning

## Vad du får

- **Nya sidan** (med tidskalkyln, "Du sköter tatuerandet…") blir huvudsidan på `/for-studios` och `/sv/for-studios`. Det är den besökare möter först — den ska väcka intresset.
- **Gamla sidan** (den utförliga, med alla funktioner, kapitel och detaljer) flyttas intakt till `/for-studios/features` och `/sv/for-studios/features`. Inget innehåll tas bort.
- På nya sidan läggs en tydlig länk/knapp: "Read more about the features" / "Läs mer om alla funktioner" som leder till den gamla sidan. En länk tillbaka läggs på den gamla sidan.
- Sidan **publiceras** när allt är klart.

## Tekniska detaljer

1. Acceptera draftet "Studiosida med tidskalkyl" (drft_01m4kw49k3fsyrp3tefmfrgy4z) till huvudprojektet.
2. Kopiera nuvarande gamla `ForStudiosPage`-innehåll till nya routes `src/routes/for-studios.features.tsx` och `src/routes/sv/for-studios.features.tsx` med egna SEO-huvuden (noindex ej nödvändigt, men egna titlar/beskrivningar, hreflang-par).
3. Nya sidan (från draftet) behåller `/for-studios` och `/sv/for-studios` med oförändrade SEO-huvuden.
4. Lägg till länk "Read more about the features" / "Läs mer om alla funktioner" på nya sidan (båda språken), samt en tillbakalänk på den gamla.
5. Verifiera: typecheck + build, Playwright-koll på 390 px och 1280 px, båda språken, att länkarna fungerar.
6. Publicera (frontend) när du godkänt — publiceringen sker via Publish-knappen/verktyget.

## Öppen punkt

Desktop-layouten för nya sidan (två kolumner, sticky kalkyl) ingår inte här — den kan byggas i ett separat steg om du vill. Sidan fungerar på dator som den är, men inte optimerad.
