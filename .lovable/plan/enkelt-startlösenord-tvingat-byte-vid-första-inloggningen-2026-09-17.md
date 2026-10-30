# Enkelt startlösenord + tvingat byte vid första inloggningen

## Vad du får

1. På /adminsignup kan du sätta ett enkelt tillfälligt lösenord åt studion (minst 8 tecken), utan att systemet stoppar det som "för lätt att gissa".
2. Första gången studion loggar in landar de på en skärm som kräver att de väljer ett eget, starkare lösenord innan de kommer in i panelen.
3. "Forgot password" finns redan på artistinloggningen och på /auth — jag kontrollerar att länken syns tydligt och att återställningsmejlet leder rätt.

## Så gör vi

**1. Tillåt enkla starlösenord**
Den inbyggda kontrollen mot kända läckta lösenord stängs av så att ett tillfälligt lösenord du hittar på går igenom. Minimilängden 8 tecken behålls.
Avvägning: kontrollen gäller hela appen, så även kunder kan då välja ett läckt lösenord. Det vägs upp av att studios tvingas byta direkt vid första inloggningen. Säg till om du hellre vill behålla kontrollen på — då får du i stället ett auto-genererat tillfälligt lösenord att skicka vidare.

**2. Flagga "måste byta lösenord"**
Nya studios som skapas via /adminsignup markeras som "tillfälligt lösenord". Flaggan rensas så fort de valt ett eget.

**3. Skärm för nytt lösenord**
Efter inloggning skickas studion till en sida som ber om nytt lösenord (två gånger, minst 8 tecken). Det går inte att hoppa över — panelen öppnas först när bytet är klart. Sidan visar också en tydlig "Logga ut"-utväg.

**4. Forgot password**
Genomgång av knappen på artistinloggningen: att den syns utan att man först måste fylla i något konstigt, och att mejlet leder till sidan där man sätter nytt lösenord.

## Tekniska detaljer

- Migration: `must_change_password boolean not null default false` på `artist_profiles`; `createApprovedStudio` sätter `true`.
- `supabase--configure_auth` med `password_hibp_enabled: false`.
- Ny route `src/routes/artists.set-password.tsx` (kräver inloggning): `supabase.auth.updateUser({ password })` + nollställ flaggan via serverfunktion med `requireSupabaseAuth`.
- Gate i artistpanelens layout/dashboard: läser flaggan och redirectar till set-password-sidan.
- `adminsignup.tsx`: hjälptext om att studion byter lösenord vid första inloggningen.
- AR-låset rörs inte. Verifiering: `bun test` (16/16), `bunx tsgo --noEmit`, build.
