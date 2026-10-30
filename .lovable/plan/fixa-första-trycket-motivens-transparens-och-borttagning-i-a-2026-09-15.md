# Fixa första trycket, motivens transparens och borttagning i AR

## 1. Startsidan ska fungera med ett tryck

- Skicka med ett tydligt startläge även från **Try a design** på startsidan.
- Låt AR-vyn läsa detta startläge och öppna kameran direkt, i stället för att visa samma startmeny en gång till.
- Behåll direktlänken till `/ar` utan startläge som den fristående startmenyn.
- Gör **My account**-kortets klickbara yta stabil medan inloggningsstatus läses in, så inget första tryck kan tappas när innehållet uppdateras.
- Testa varje knapp på startsidan med exakt ett mobiltryck: Try a design, Upload picture, Text, AI creator, Sketch your own och My account.

## 2. Rensa hela motivsamlingen ordentligt

- Inventera alla publicerade motiv, inte bara de senast uppladdade, och koppla varje post till samma rena original i biblioteket, Sleeve Builder och galleriet.
- Kör en ny konsekvent transparensbehandling där vit och nästan vit bakgrund tas bort även i helt inneslutna områden inne i motivet.
- Låt mörka linjer vara opaka och tona grå kantpixlar mjukt, så resultatet inte får vita glorior eller taggiga kanter.
- Beskär varje bild tätt med en liten jämn marginal efter rensningen.
- Ersätt den nuvarande bakgrundsmetoden som bara följer vitt från bildkanten; den är orsaken till att slutna vita fält blir kvar.
- Använd samma regler för framtida uppladdningar och AI-motiv, så felet inte återkommer beroende på var motivet skapades.
- Kontrollera kategorin för varje motiv och säkerställ att samma kategori visas i biblioteket, Sleeve Builder och galleriet.

## 3. Enkel borttagning direkt på motivet i AR

- Ett långtryck på ett eget motiv markerar just det motivet och visar ett tydligt **kryss i övre högra hörnet**.
- Ett vanligt kort tryck fortsätter att välja motivet som tidigare.
- När långtrycket har aktiverats får efterföljande klick inte samtidigt välja eller flytta motivet.
- Horisontell svepning i motivraden avbryter långtrycket, så scrollning aldrig råkar aktivera borttagning.
- Tryck på krysset tar bort motivet. Tryck någonstans ovanför motivraden eller på övrig kamerayta stänger borttagningsläget och återställer normal vy.
- Ta bort den nuvarande separata borttagningsrutan för sparade motiv och använd samma tydliga beteende för egna uppladdningar där det är relevant.
- Nollställ aktivt kryss om motivraden döljs av låsning, inspelning eller en annan meny.

## Kontroll före leverans

- Automatisk pixelkontroll: inga opaka eller nästan opaka vita områden får finnas kvar i de rensade motiven.
- Visuell kontaktkarta på ljus, mörk och hudlik bakgrund för att upptäcka vita öar, glorior och skadade linjer.
- Mobiltest av biblioteket, Sleeve Builder och galleriet med kategorifilter och bildladdning.
- Mobiltest av ett enda tryck från startsidan till rätt mål.
- Mobiltest i AR: kort tryck, långtryck, svepning, kryss, borttagning och tryck utanför.
- Kör tester, typkontroll och byggkontroll. AR-låsets OpenCV-spårning och filterkedja lämnas orörda.

## Tekniska detaljer

- Utöka AR-startparametern med `design` och hantera den tillsammans med befintliga `upload` och `text` innan kameran visas.
- Behåll en stabil länkstruktur för kontoalternativet medan autentiseringen laddas.
- Ersätt binärt `edgesOnly`-beteende med en gemensam luminans-/alfaprofil för vitrensning och samma tolerans/fjädring i alla tre skapandeflöden.
- Lägg till en verifiering som stoppar eller flaggar en bild om ett kvarvarande nästan vitt opakt område överskrider gränsvärdet.
- I motivraden används ett markerat motiv-id, rörelsetröskel för långtryck och blockering av klicket som annars följer efter `pointerup`.
