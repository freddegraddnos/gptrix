# Låst AR: storleken vandrar av sig själv

## Vad videon visar
Handen står i stort sett stilla på samma avstånd, men cm-värdet i "LOCKED"-pillret vandrar hela tiden:

```text
6.4 → 7.2 → 5.9 → 5.7 → 5.4 → 5.0 → 4.2 → 3.3 → 3.2 → 4.0 → 4.0 → 2.9 → 8.4 → tracking lost
```

Motivet krymper alltså till hälften och hoppar sedan upp till mer än dubbelt, utan att du rört kameran motsvarande. Runt 00:09–00:14 glider motivet dessutom av handen och ligger kvar på bakgrunden innan låset tappas helt vid 00:21.

## Grundorsak
Skalan mäts inte mot en fast referens. Varje gång spårningen ankrar om bakas den hittills uppmätta skalan in i en ny baslinje, och nästa mätning multipliceras ovanpå den. Små mätfel adderas därför aldrig ut — de förstärks. Vid omankring nollställs dessutom den relativa skalan i kameravyn medan baslinjen står kvar, vilket ger de synliga hoppen. När kedjan har drivit långt bort från verkligheten hamnar sökområdet fel, motivet glider av huden och spårningen dör.

## Lösning

1. **Absolut skalreferens.** Spara vid låsningen en referensmätning av hur brett spårningsmönstret är i bild. Varje frame beräknas storleken som förhållandet mellan nuvarande och ursprunglig bredd, inte som en produkt av alla mellanliggande steg.
2. **Omankring utan skalbakning.** När features byts ut ska den nya uppsättningen mätas mot samma ursprungsreferens (via en engångsöversättning), så en omankring aldrig i sig ändrar storleken.
3. **Driftspärr.** Om den absoluta mätningen och den utjämnade skalan glider isär mer än ett rimligt spann utan motsvarande rörelse behandlas det som en dålig mätning, inte som en storleksändring.
4. **Ta bort nollställningen av relativ skala vid trackerbyte** i kameravyn, som orsakar de stora hoppen mellan bildrutor.
5. **Håll motivet på huden.** Om ankarpunkten hamnar utanför hudområdet flera frames i rad ska låset gå till "tracking lost" direkt i stället för att fortsätta rita på bakgrunden.

Tracking-lost-bannern, låsanimationen, uppdateringsfrekvensen och närbildslogikens "Too close"-varning lämnas orörda.

## Teknisk omfattning
- `src/lib/flowLock.ts`: absolut skalreferens i spårningsläget, omankring som bevarar referensen, driftspärr på skala.
- `src/components/ARCamera.tsx`: ta bort skal-nollställningen vid trackerbyte, hudvalidering av ankarpunkten i låst läge.

Inga andra filer.

## Verifiering
Typecheck, build och genomgång av diffen. Att storleken verkligen ligger still kräver test på telefon — jag kan inte reproducera fysisk handrörelse här.
