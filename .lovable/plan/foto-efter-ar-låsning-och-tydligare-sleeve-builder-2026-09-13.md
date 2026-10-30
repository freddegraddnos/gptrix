# Foto efter AR-låsning och tydligare Sleeve Builder

## Mål
- Fotoavtryckaren ska fungera även efter att motivet låsts och bilden ska visa den aktuella låsta placeringen.
- Mörka motiv ska synas tydligt på Sleeve Builders arbetsyta.

## Genomförande
1. **Säkra foto efter låsning**
   - Förhindra att den automatiska låsbilden och ett manuellt foto försöker läsa samma kamerabild samtidigt.
   - Låt fotoögonblicket använda den senaste låsta positionen och spara samma resultat till förhandsvisningen.
   - Behåll video, tracking-lost och själva låsalgoritmen oförändrade.

2. **Öka kontrasten i Sleeve Builder**
   - Byt arbetsytan från nästan svart till den befintliga ljusa flash-paper-färgen.
   - Anpassa tomlägets text och kant så de är tydliga på den ljusa ytan.
   - Behåll exporter med transparent respektive mörk bakgrund som de fungerar nu.

## Verifiering
- Testa mobilflödet: lås motivet, ta foto och kontrollera att bildförhandsvisningen öppnas med kamerabild och motiv.
- Kontrollera Sleeve Builder med ett mörkt motiv på mobil och desktop.
- Kontrollera typfel och aktuell byggstatus.
