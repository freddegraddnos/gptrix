# Rätta navigation, guidegenvägar och studiospråk

## Omfattning
- Behåll dagens menygrupper och alla befintliga studiofunktioner.
- Rätta guideknappar och instruktioner så de pekar på de faktiska arbetsvyerna, särskilt SMS-aviseringar.
- Låt menygrupper enbart expandera; byt arbetsvy först när en undersida väljs.
- Synkronisera vald arbetsvy med URL för direktlänk, omladdning, tillbaka och framåt.
- Skydda formulär med verkliga osparade ändringar innan användaren lämnar vyn.
- Samordna svenska och engelska texter utifrån studioinställningen eller ingångsspråket.

## Teknisk lösning
- Använd den befintliga gemensamma navigationskällan för sidomeny, “Gå till” och mobilmeny.
- Flytta URL-fliken till validerad route search state och uppdatera historiken vid varje undersidesval.
- Lägg till en gemensam navigationsspärr kopplad till befintliga dirty-signaler, utan att ändra sparlogik eller data.
- Rätta guiden till `notifs` och uppdatera gamla menyetiketter på båda språken.

## Verifiering
- Testa svenska och engelska på dator och mobil.
- Testa tangentbord, grupp-expansion, undersidesval, direktlänk, omladdning samt tillbaka/framåt.
- Verifiera att osparade ändringar varnas och att inga SMS eller andra meddelanden skickas.
- Kontrollera build och relevanta tester. Ingen publicering.
