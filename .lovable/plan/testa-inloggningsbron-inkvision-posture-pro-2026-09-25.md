# Testa inloggningsbron InkVision → Posture Pro

## Mål
Kontrollera att en InkVision-studio kan bekräftas av Posture Pro med sin InkVision-inloggning.

## Steg
1. **Publicera InkVision** så att kontrolladressen `https://inkvision.app/api/public/partner/verify-studio` svarar live (den finns inte på förhandsvisningar).
2. **Testa kontrolladressen direkt** med tre anrop:
   - Fel nyckel → ska ge 401 (nekad).
   - Rätt nyckel + fel lösenord → ska ge `{ "ok": false }`.
   - Rätt nyckel + riktig studio-inloggning → ska ge `{ "ok": true, "studioName": "..." }`.
   För det tredje testet skapar jag en tillfällig teststudio via /adminsignup (FRITZ) och raderar den efteråt, så ingen riktig studios lösenord behövs.
3. **Testa hela flödet på Posture Pros inloggningssida** med teststudions e-post och lösenord i webbläsaren och ta skärmbild av resultatet.
4. **Rapportera** vad som fungerar och exakt vad som eventuellt behöver rättas i Posture Pro (t.ex. nyckeln stämmer inte, eller inloggningen skapar inte kontot).

## Tekniska detaljer
- Nyckeln kan inte läsas tillbaka; test med rätt nyckel körs via en serveranrop i InkVision som läser `POSTURE_PRO_BRIDGE_SECRET` utan att visa värdet.
- Posture Pro-sidan testas via dess publicerade adress; om den inte har bron implementerad ännu stannar testet vid steg 2 och jag rapporterar det.
- Teststudion och dess konto raderas ur databasen efteråt.
