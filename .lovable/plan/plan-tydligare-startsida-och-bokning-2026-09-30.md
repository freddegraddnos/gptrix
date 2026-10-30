# Plan: tydligare startsida och bokning

- Flytta **STUDIO LOGIN** till övre vänstra hörnet och lägg **LOGIN** i övre högra hörnet på startsidan. Behåll deras befintliga destinationer för studio respektive kundinloggning, och ge dem tillräcklig tryckyta på mobil utan att täcka loggan.
- Flytta **Think it — Try it — Ink it** från platsen under valen till precis ovanför den översta ljuspulserande knappen. Låt textens lila ljus tona in och ut i takt med knappens befintliga puls; stilla båda effekterna vid reducerad rörelse.
- Lägg en tredje knapp, **BOOK TATTOO**, i samma visuella stil som de två befintliga valen. Placera en kort förklarande rad i samma typografiska hierarki och länka knappen till sidan för godkända tatueringsstudior.
- Minska mörktoningen över tatueringsfotot försiktigt så motivet syns tydligare, men behåll svart yta ovanför och kring loggan samt tydlig kontrast för text och knappar.
- Kontrollera startsidan i mobil-, surfplatte- och datorstorlek: hörnlänkar, logga, knappar, pulsering och läsbarhet utan horisontell överströmning. AR-kamerans egen startmeny och AR-låset ändras inte.

## Tekniska detaljer

Startsidan använder `TryOnStartMenu`, som också används i AR-kameran. De nya startsidesspecifika länkarna och bokningsvalet begränsas till startsidans variant. Den befintliga ljusknappen animeras med `beam-fade` (4,6 sekunder); den flyttade slogans ljus använder samma rytm. Bakgrundens toning ligger i `.home-photo` och justeras utan att påverka den översta svarta masken.
