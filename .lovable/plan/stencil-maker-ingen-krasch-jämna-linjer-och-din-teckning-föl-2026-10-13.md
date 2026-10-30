# Stencil maker: ingen krasch, jämna linjer och din teckning följer med

## Vad koden visar
- **Din teckning följer inte med.** Stencil maker öppnas alltid på steg 1 med "Ladda upp bild" och får inget från ritduken. Det du har ritat skickas aldrig över.
- **Bakgrundsborttagningen är påslagen som standard.** Den laddar en stor AI-modell i webbläsaren och körs på varje bild, även på ren linjeteckning. Den är den troligaste orsaken till kraschen på dator, men det är inte bekräftat än.
- **Bakgrundsborttagningen krymper också bilden till max 1024 px innan linjerna räknas fram.** Förhandsvisningen räknas dessutom bara i 900 px. Därför blir linjerna trappstegiga och ojämna när de visas stort på dator.

## Vad som byggs
1. **Teckningen skickas direkt till Stencil maker.**
   - När du trycker Stencil i ritprogrammet tas det du har ritat med automatiskt, i rätt storlek (mm), och du hamnar direkt på steg 2.
   - "Byt bild" finns kvar om du vill ladda upp något annat.
   - Är duken tom börjar det som i dag med uppladdning.
2. **Bakgrundsborttagning bara när den behövs.**
   - Den är avstängd för teckningar från ritprogrammet och för motiv som redan är linjeteckning.
   - För foton är den på som i dag och kan stängas av.
   - Bilden krymps inte längre till 1024 px innan linjerna räknas fram.
3. **Jämna linjer.**
   - Förhandsvisningen räknas i den upplösning skärmen faktiskt visar, upp till 2000 px.
   - Linjeteckning görs om till släta vektorkurvor, där raka bitar rätas ut. Samma kurvor används i förhandsvisning, PDF och SVG, så linjerna ser lika ut överallt.
4. **Ingen krasch.**
   - Först återskapar jag kraschen i datorstorlek med ett motiv med raka linjer, för att bekräfta orsaken.
   - Sedan läggs skydd in: om bakgrundsborttagningen misslyckas fortsätter verktyget utan den och visar ett meddelande, och sidan stängs inte.
5. **Test och kontroll.**
   - Ett test kontrollerar att raka linjer förblir raka efter vektoriseringen.
   - En kontroll i webbläsaren, både dator 1440×900 och mobil 390, går hela vägen: rita → Stencil → steg 2 → utskrift.
   - Skärmbilder före och efter.

## Tekniska detaljer
- `PaintApp.tsx`: när Stencil öppnas skickas `engine.toArtworkPNG()` (vit matt) och `doc.mmPerPixel` som `initialImage` och `initialWidthMm` till `StencilMode`. På en tom duk skickas inget.
- `StencilMode.tsx`: `initialImage` laddas direkt med `load()`. Med `fromCanvas` sätts `removeBg=false` och stilen `lineart`, och bredden tas från mm-skalan. Förhandsvisningens `maxSide` blir `min(2000, displayWidth × dpr)`. `computeMask` får try/catch och timeout, och vid fel sätts `removeBg=false` och en toast visas.
- `bgMask.ts`: masken skalas upp till originalets storlek i `composite`, så att källan inte krymps till maskens upplösning.
- Vektorisering: tracer i workern (marching squares → Ramer-Douglas-Peucker med rakhetströskel → kubiska Bézier-kurvor). Den ger en SVG-sökväg som rastreras för förhandsvisning och PDF och exporteras direkt som SVG.
- AR, ritmotorns logik och lagring ändras inte.
