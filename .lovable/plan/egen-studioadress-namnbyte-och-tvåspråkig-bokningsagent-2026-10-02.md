# Egen studioadress, namnbyte och tvåspråkig bokningsagent

## 1. Egen adress för varje studio
Varje studio får en egen, snygg adress på InkSimulator som samlar allt:
- `www.inksimulator.com/s/<studionamn>` – studiosida
- `.../boka/<studionamn>` – bokning (finns redan)
- `.../agent/<studionamn>` – bokningsagent (finns redan)

Alla tre visas i studiopanelen under Profil med kopiera-knapp och QR-kod.

Obs: helt egna domäner (t.ex. `minstudio.se`) kräver att studion köper domänen och pekar den hos sin domänleverantör – det går inte att automatisera säkert härifrån. Det ingår därför inte, men kan läggas till senare som manuell tjänst.

## 2. Byta namn och adress
I Profil får studion två fält:
- **Studionamn** (visas för kunder) – kan ändras fritt.
- **Adress** (`inksimulator.com/.../<namn>`) – kan ändras, med direkt kontroll om namnet är ledigt (endast små bokstäver, siffror och bindestreck, 3–30 tecken).

Den gamla adressen fortsätter fungera och skickar vidare till den nya, så länkar i Instagram-bio och QR-koder inte går sönder.

## 3. Tvåspråkig agent
- Ny inställning under **Bokningsagent**: *Grundspråk* – Svenska eller English.
- Chattsidan visar välkomsttext, knappar och rubriker på grundspråket.
- Agenten känner av språket kunden skriver på och svarar på det språket.
- Bokningsbekräftelse till kunden (SMS, kalenderinbjudan, text i chatten) skickas på **kundens** språk.
- Notiser till studion (e-post, SMS, i panelen) skickas alltid på **studions grundspråk**, oavsett kundens språk.

## Tekniska detaljer
- Migration: `studio_agent_settings.language text default 'sv' check in ('sv','en')`; `agent_bookings.customer_lang text`; ny tabell `studio_handle_history (old_handle unique, user_id, created_at)` med grants + RLS (anon select för redirect).
- Server-funktion `changeStudioHandle` (requireSupabaseAuth): validerar format, använder `is_handle_available`, sparar gammalt handle i history, uppdaterar `artist_profiles.handle`.
- `loadAgentStudio`, `/boka/$handle`, `/u/$handle` och ny `/s/$handle` slår upp history vid miss och redirectar (301) till nytt handle.
- `agent.server.ts`: systemprompt får grundspråk; `book`-verktyget får parametern `customer_language` ('sv'|'en') som modellen sätter utifrån kundens text; sparas på bokningen. `afterBooking` väljer kundtexter efter `customer_lang` och studiotexter efter `settings.language`.
- `agent.$handle.tsx`: UI-strängar i sv/en efter grundspråk.
- `StudioAgentSettings.tsx`: språkväljare; Profil i `artists.dashboard.tsx`/`StudioWorkspace`: adressfält + länklista.
- Verifiering: tsgo, Playwright på panel och chatt, testbokning lokalt på svenska och engelska.
