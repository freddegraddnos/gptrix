# SMS-aviseringar för studios via 46elks

## Vad studion får
- I studiopanelen under Profil: ny ruta "Aviseringar för förfrågningar" (SV/EN).
  - Mobilnummer (+46...), med kontroll av formatet.
  - Val: E-post, SMS eller båda.
  - Knapp "Skicka test-SMS".
- Vid varje ny kundförfrågan skickas ett kort SMS från avsändaren "InkVision":
  "Ny förfrågan från <namn> – <placering>. Öppna: inkvision.app/artists/requests/<id>"
- Om SMS misslyckas (eller nycklar saknas) skickas e-post som vanligt, så inga förfrågningar tappas.

## Vad du gör sen
När du har 46elks-kontot öppnar jag ett säkert formulär där du klistrar in API Username och API Password. Fram till dess fungerar allt som idag med e-post, och testknappen säger "SMS inte aktiverat än".

## Tekniska detaljer
- Migration: kolumner på artist_profiles: `notify_phone text`, `notify_email_enabled boolean default true`, `notify_sms_enabled boolean default false` (befintliga RLS för ägaren gäller).
- `src/lib/sms.server.ts`: `sendSms(to, message)` via POST https://api.46elks.com/a1/sms, Basic auth med ELKS_API_USERNAME/ELKS_API_PASSWORD, from "InkVision"; returnerar `{ok, reason}`; ingen krasch om secrets saknas.
- `projectRequests.functions.ts` (där förfrågningsmejlet skickas idag, rad ~236): läs de nya fälten, skicka SMS om påslaget, e-post om påslaget eller om SMS misslyckas.
- Ny server fn `sendTestSms` (requireSupabaseAuth, bara till eget nummer).
- UI-kort i studiopanelens Profil-flik i StudioWorkspace/artists.dashboard, texter via inkvision.studio-lang.
- AR-motorn rörs inte; tester/typecheck/build ska vara gröna.
