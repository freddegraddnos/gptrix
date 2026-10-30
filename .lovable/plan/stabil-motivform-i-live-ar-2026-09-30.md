# Stabil motivform i Live AR

## Mål

Motivet ska behålla sin form när det är låst mot huden. Det får följa verklig rörelse, avstånd och rotation, men inte plötsligt böjas, smalna av eller byta omslutning utan ett nytt medvetet val.

## Genomförande

1. Återskapa formändringen i Live AR och skilj mellan ändringar före låsning, under låsning och vid motivbyte eller ny kalibrering.
2. Säkra att den valda ytformen och den färdigberäknade motivbilden förblir samma från det att låsningen startar tills användaren låser upp. Ändringar i omslutningsreglage, skanning eller sparad ytprofil får inte byta form mitt under en låsning; låt användaren justera dem när låset släppts.
3. Se till att en fördröjd bildberäkning inte tillfälligt visar det platta originalet eller ersätter en nyare låst form. Behåll samma motivproportioner i livevyn och foto-/videofångst.
4. Lägg till deterministiska regressionstester för låst form, sen färdig bildberäkning och upplåsning. Kontrollera mobil- och datorvy samt kör relevanta AR-tester och kontroll av fel.

## Tekniskt

Kodgenomgången visar att automatisk kurvatur och armriktning redan pausar när låsning påbörjas, men omslutningsreglage och ytprofil kan fortfarande uppdatera formtillståndet under låsning. Motivets bild bakas dessutom asynkront och visas via separat tillstånd. Undersök och åtgärda dessa vägar lokalt i Live AR:s presentations- och låstillstånd, utan att ändra OpenCV, optisk flödesberäkning eller övriga AR-spårningsalgoritmer. Den exakta orsaken till den upplevda formändringen fastställs i steg 1 innan fixen väljs.
