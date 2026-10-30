# Stabilisera motivet i Live AR

**Mål:** När ett motiv är låst på huden ska det följa rörelsen utan att glida, pulsera i storlek eller ändra form av sig självt. Foto-läget och övrig AR-funktionalitet ska vara oförändrade.

1. **Återskapa och mät felet.** Prova låsning med stilla kropp, rörelse, ändrat avstånd, rotation och kortvarigt tappad spårning. Kontrollera om position, skala och form ändras i mätningen, utjämningen eller bildvisningen innan åtgärden väljs.
2. **Rikta åtgärden till felande led.** Bevara kroppens avsiktliga perspektivförändring när avståndet faktiskt ändras, men håll den skannade formen och motivets fysiska storlek stabila. Avvisa opålitliga mätvärden och undvik hopp vid förlorad/återupptagen spårning. Ändra bara den del av Live AR som orsakar problemet; ingen generell omskrivning av AR-motorn.
3. **Verifiera mot regressioner.** Lägg deterministiska tester för stillastående brus, verklig rörelse/avståndsändring, tappad spårning och återlåsning. Kör befintliga tester, typkontroll och kontroll av sidans bygge; granska att ändringen inte berör andra AR-delar utanför den riktade fixen. Kontrollera kameraflödet i webbläsare där kameraåtkomst finns.

## Teknisk avgränsning

`/ar` använder Live AR-kamerans spårning och ett separat positionsfilter. Formen läses från videoskanning och uppdateringen stoppas redan när låset är aktivt; filter och tracker tillåter däremot vissa positions- och skalförändringar. Det bevisar ännu inte var just detta fel uppstår, så första steget fastställer orsaken innan någon motorfil ändras. Befintliga stabilitetstester täcker syntetiskt brus och återankring men inte hela kamerakedjan.
