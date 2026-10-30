# /for-studios: ny arbetsversion med tidskalkyl

Görs i en separat förhandsversion (utkast). Publiceras inte automatiskt. AR, kamera, kalibrering, betalningar, behörigheter och databas rörs inte.

## Innehåll (ordagrant enligt specifikationen)
- Svenska/English-växlare tydligt överst. Rubrik SV: "Du sköter tatuerandet, / Vi sköter resten." EN: "You do the tattooing, / We take care of the rest." Ingressen exakt som angiven (engelsk översättning av ingress, kalkyl och resultat).
- Kalkyl "Värdet av din frigjorda tid" direkt i första mobilvyn, med kronbeloppet synligt. Synliga fält: minuter/kund (20), kunder/vecka (5), timvärde (800 kr, markerat som redigerbart exempel). 52 arbetsveckor. Startvärde ca 5 778 kr/månad. Informationen om egna antaganden behålls.
- "Räkna med fler tjänster": kryssrutor Stencil Maker (extra min/kund), Fortnox (extra min/månad), Leads/annonser (extra min/månad, egen arbetstid — ej annonsbudget eller garanterade kunder). Alla börjar på 0 och anges som ingående, inte tillval att köpa.
- "Så räknar vi": arbetsveckor och delposter. Begriplig återkoppling vid felaktig inmatning.
- Fast "Boka kostnadsfri demo"-knapp som följer med vid skroll, respekterar safe-area, med bottenmarginal. Öppnar mejl till fredrik@inksimulator.com.
- Funktionslista med bockar: Studio- och artistprofiler; Kunddialog, skisser och bokningar; AR-provning inför besöket; Stencil Maker och lead generation; Fortnox-integration. Länk till den godkända guiden.
- Tas bort på båda språken: "Uppskattat tidsvärde före avgifter…", raden med 299 kr/mån, 5 % och prislänken, samt "Mejla Fredrik · se hur…". De tidigare långa säljavsnitten återinförs inte. Guiden och prissidan ändras inte.

## Beräkning
- Grund h/mån = kunder × minuter × 52 / 720
- Stencil h/mån = kunder × extra stencilmin × 52 / 720 (om vald)
- Fortnox / Leads h/mån = extra min / 60 (om vald)
- Totalvärde = summa timmar × timvärde. Full precision, avrundad visning.
- Kalkylens värden sparas så de finns kvar vid språkbyte och efter besök i guiden.

## Kontroll
320, 360 och 390 px, båda språk, tangentbord och förstorad text; alla tjänsteval, bortval, nollvärden och återgång från guiden. Tester för formlerna (bl.a. 5 778 kr som grundvärde).

## Öppen punkt
Referensbilderna (02-studiosida-svenska.jpg, 03-studiosida-engelska.jpg) och den klickbara prototypen nämns i dokumentet men är inte uppladdade. Utan dem följer jag befintlig svart/vit/lila stil (#8A5BF2, Anton, DM Mono) och texten ovan. Ladda gärna upp dem om layouten ska matcha exakt.

## Tekniska detaljer
- Ny presentation i `ForStudiosPage.tsx` (båda språk-URL:erna behålls, SEO-huvuden oförändrade). Beräkning i ren modul `src/lib/studioTimeValue.ts` + `tests/studioTimeValue.test.ts`.
- Kalkylvärden i sessionStorage; språk via befintlig `usePublicStudioLang`.
- Arbete i utkast (drafts) innan införande.
