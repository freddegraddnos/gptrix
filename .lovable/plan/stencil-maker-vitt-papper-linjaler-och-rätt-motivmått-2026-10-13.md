# Stencil Maker – vitt papper, linjaler och rätt motivmått

## Ändringar i steg 3: Size & Print

1. **Vitt papper**
   - Pappersytan blir rent vit i både mörkt och ljust läge, även för A3 och Letter.
   - Övriga menyer behåller sitt nuvarande tema.

2. **Skalriktiga linjaler**
   - Visa en linjal till vänster och en under pappret, utanför själva utskriftsytan.
   - Centimetersiffror och millimetermarkeringar följer papprets verkliga mått och samma visuella skala som motivet.
   - A4 stående visar 21 × 29,7 cm; A3 stående visar 29,7 × 42 cm. Liggande format byter axlarna. Letter följer sina faktiska mått.
   - Linjalerna är stöd på skärmen och kommer inte med i motivexport eller vanlig utskrift.

3. **Storleken gäller själva motivet**
   - Identifiera yttergränserna för de synliga stencillinjerna efter bearbetning och manuella justeringar.
   - Uteslut tomma kanter från storleksberäkningen. Exempel: 15 cm bredd ska betyda 15 cm från motivets yttersta vänstra till yttersta högra linje, inte den större bildrutan.
   - Låst proportion, storleksknappar, markeringsruta, placering och export använder samma motivgränser.
   - Bredd/höjd avser motivet före rotation; rotation ändrar utrymmet det upptar på pappret, inte dess inställda storlek.
   - En helt tom stencil ska inte kunna ge en missvisande utskrift.

## Teknisk avgränsning

- Pappersvisningen i `StencilPrint` använder nu `bg-background`, och proportionerna skickas från hela källbilden i `StencilMode`. Dessa kopplingar ändras för papperskontrast och motivbaserade mått.
- Beräkna motivgränser från den frysta, bearbetade stencilen. Använd samma beskärningskoordinater genom förhandsvisning och högupplöst utskrift/export, med korrekt omräkning av skala.
- Behåll PDF i fysisk sidstorlek, 300 DPI, PNG/SVG, spegling, rotation, dragplacering, kalibreringstest och siduppdelning med 10 mm överlapp.
- Ändra inte linjerensningen, AR, lagring eller övriga ritverktyg.
- Nya etiketter följer befintligt SV/EN-stöd.

## Kontroll före klart

- Lägg tester för motiv med stora tomma kanter: inställd bredd 150 mm ska ge 150 mm motivbredd i exportberäkningen.
- Testa pappersmått, linjalernas koordinater, proportioner, rotation och tom stencil.
- Kontrollera steg 3 inloggad som studio på dator och mobil, i mörkt/ljust läge och med A4/A3 stående/liggande.
- Exportera en test-PDF och kontrollera sidstorlek och motivmått. Fysisk utskrift behöver fortsatt göras i 100 % / faktisk storlek.

Ingen publicering ingår.