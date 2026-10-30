# Stencil maker: rena raka linjer och ingen krasch

## Vad som är fel idag
- Linjemotorn letar efter **kanter** runt varje streck i stället för själva strecket. En rak linje ger då två kanter, som sedan tunnas ner till en mittlinje. Mittlinjen hamnar mellan pixlarna och blir ojämn och vågig.
- Kraschen har jag inte bekräftat än. Troligen beror den på att slutbilden räknas ut i full utskriftsstorlek (300 DPI). Det kan bli flera miljoner pixlar, och då tar minnet slut på mobilen.

## Vad som byggs
1. **Nytt läge "Linjeteckning"**, förvalt när motivet redan består av linjer. Mörka streck behålls som de är, men kanterna jämnas ut och små prickar städas bort. Raka linjer förblir raka och behåller sin tjocklek. Förinställningarna Outline, Simple och Detailed för foton finns kvar.
2. **Utjämning av linjer:** linjerna görs om till släta kurvor, och nästan raka bitar rätas ut. Det används både i förhandsvisningen och i PDF/SVG.
3. **Ingen krasch:**
   - Bildstorleken får ett tak som passar telefonens minne.
   - Om beräkningen misslyckas eller tar slut på minne syns ett felmeddelande, och sidan stängs inte.
   - Arbetet kan avbrytas om man byter inställning.
4. **Test:** en bild med raka linjer måste fortfarande ge raka linjer och samma tjocklek i ±1 px. En stor bild ska ge ett svar, inte en krasch.

## Ordning
1. Först återskapar jag kraschen med ett motiv med raka linjer, på mobilstorlek, för att hitta orsaken.
2. Sedan bygger jag linjeläget och utjämningen.
3. Till sist lägger jag in skyddet mot krasch och verifierar före och efter med skärmbilder.

## Tekniska detaljer
- `stencilEngine.ts`: nytt `style: "lineart"`. Det gör tröskling med Otsu, tar bort prickar och fyller små hål. Det kör ingen kantdetektering, ingen bilateral filtrering och ingen skelettering. Tjockleken behålls, eller sätts om via avståndstransform när användaren väljer en tjocklek.
- Utjämning: Potrace-liknande kurvanpassning i den befintliga vektorexporten, med rakhetströskel. Rastret i förhandsvisningen ritas från samma vektorbanor.
- `stencilClient.ts`: `worker.onerror` och `messageerror` avvisar väntande anrop. Pixeltaket ligger på cirka 12 MP och tiling används vid större utskrift. Det finns en timeout.
- `StencilMode.tsx`: linjeläget väljs automatiskt när bilden mest är svart på ljust, och fel visas med toast.
- AR, ritmotor och lagring berörs inte.
