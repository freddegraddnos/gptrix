# Tydligare rutnät över tatueringen

- Förstärk det lila rutnätet över kroppens vänstra och mellersta delar på startsidan, så att det syns över huden och tatueringen snarare än främst över telefonen.
- Anpassa rutnätets avgränsning för mobil och större skärmar. Behåll svart yta ovanför loggan och läsbar text och knappar.
- Kontrollera startsidan visuellt på mobil, surfplatta och dator samt att inget annat delnings- eller AR-flöde påverkas.

## Tekniskt

Justera endast startsidans `.home-photo::before` i `src/styles.css`: maskens placering och utbredning samt rutnätets kontrast vid behov. Låt bild, navigering och AR-motor vara oförändrade.
