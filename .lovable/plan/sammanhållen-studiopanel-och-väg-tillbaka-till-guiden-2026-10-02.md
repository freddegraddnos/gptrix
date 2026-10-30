# Sammanhållen studiopanel och väg tillbaka till guiden

## Målet
När du öppnar ett steg i guiden inne i studiopanelen ska du alltid kunna gå tillbaka till guiden med en tydlig knapp. Panelens avsnitt ska kännas som samma InkSimulator-produkt i både Dark och Bright: svart, vitt och violett med läsbar text och tydliga aktiva val. Detta gäller inte den publika sidan ”För studios”, kundsidorna eller AR.

## Arbete
1. **Gör guideflödet sammanhängande.** När ett steg öppnar ett avsnitt i studiopanelen, visa en synlig ”Tillbaka till guiden” ovanför avsnittet. Låt länken fungera på mobil och dator utan att ändra hur panelens befintliga flikar eller menyn ”Requests / All sections” fungerar. Om man byter avsnitt på vanligt sätt ska knappen inte felaktigt säga att man kom från guiden.
2. **Fånga fortsatta steg utanför panelen.** Inventera faktiska länkar från guideöppnade avsnitt, till exempel uppladdning av motiv. Där man lämnar panelen ska en tydlig återväg gå till guiden när det är därifrån resan började; vid vanlig navigering behåll den naturliga återvägen. Djup- och omladdade länkar ska inte fastna på fel flik.
3. **Rätta färgerna i guidens destinationer.** Gå igenom alla fjorton avsnitt som guiden öppnar och deras närmaste sidor. Byt mörkerberoende ytor, kanter och text som blir oläsliga i Bright mot semantiska färgroller inom studiopanelen. Behåll violett som accent och kontrollera även inmatningar, statusmarkeringar och knappar. Separata studiosidor får en sammanhängande InkSimulator-palett, men sparat Dark/Bright-val ska fortsatt vara avgränsat till StudioWorkspace; kundvyer och AR påverkas inte.
4. **Kontrollera verkliga vägar.** Testa guiden → avsnitt → guiden för flera steg, samt guidens väg vidare till fristående sidor. Granska mobil (393 px), mellanbredd och dator i Dark och Bright, inklusive kontrast, text som ryms och att befintliga menyval ligger kvar. Kör relevanta navigeringstester och kontrollera automatisk byggstatus samt diffen utan att ändra AR-låset.

## Tekniska ramar
- Guiden i `StudioGuide` byter i dag panelens lokala `tab`-state i `artists.dashboard.tsx`; där finns ingen uttrycklig tillbaka-knapp. Ursprung från guiden behöver därför spåras separat från normalt flikbyte och kunna återställas vid relevant sidnavigering.
- `StudioWorkspace` äger studiopanelens Dark/Bright-scope. Flera avsnitt använder äldre mörka färgklasser trots detta, medan fristående `/artists/*`-sidor använder en annan sidram. Rätta färger där de faktiskt används i stället för att ändra webbplatsens globala tema.
- Den befintliga generella ”Tillbaka till panelen”-knappen på fristående studiosidor är inte samma sak som ”Tillbaka till guiden”; välj rätt mål utifrån var användaren kom från, utan att tappa sidornas vanliga navigering.
