# Ny studio: enkel start, tydlig inloggning och tre-stegs uppstart

## 1. Startvy med två huvuduppgifter
- Studiopanelens översikt visar två stora kort: "Ta emot kundförfrågningar" (leder till uppstarten/aviseringar) och "Publicera motiv" (visning eller försäljning).
- Inkorg och Profil ligger kvar synliga i menyn.
- Övriga flikar samlas under "Alla verktyg". Tekniska/sällan använda (Agent, Fortnox, Instagram, kalendersynk, SMS-detaljer, sidbyggarens avancerade delar) under "Avancerade inställningar". Inga flikar tas bort; befintliga länkar och djuplänkar fungerar som förut.

## 2. Tydlig inloggning
- På /for-studios, /artists och guiderna (SV/EN) visar sidhuvudet två separata knappar: "Logga in" / "Log in" och "Kom igång med din studio" / "Get started with your studio".
- Dator: båda syns direkt i sidhuvudet. Mobil: "Logga in" syns alltid i sidhuvudet (inte i meny eller sidfot); "Kom igång" ligger i den följande bannern.
- "Kom igång" leder nya studios till intresseanmälan (nya studios godkänns manuellt, som idag). Godkända studios möts av uppstarten efter första inloggningen.

## 3. Guidad uppstart i tre steg
1. **Din studio** – studionamn, adress, e-post och telefon (förifyllt från befintliga uppgifter).
2. **Ditt arbete** – tatueringsstilar som bildkort med sökfält, flera val.
3. **Dina aviseringar** – e-post och/eller SMS, mottagare förifylld från kontaktuppgifterna men går att ändra, knapp "Skicka testavisering".

- Framsteg sparas per steg; studion kan stänga och fortsätta senare.
- Statusrad med tre separata tillstånd som aldrig blandas: "Uppgifter sparade", "Avisering testad", "Redo att ta emot förfrågningar" (kräver båda föregående).
- Avslut: primär knapp "Lägg upp ditt första motiv". Profilen kan kompletteras senare via Profil.

## Tekniska detaljer
- Ny komponent `StudioOnboarding` i StudioWorkspace-presentationen; ingen ändring av dashboard-flikarnas beteende, bara gruppering i navigationen (`studioNav.ts`) och nytt översiktsinnehåll.
- Sparar till befintliga fält: `artist_profiles` (namn, adress, stilar, kontakt), `notification_prefs`/befintliga SMS-fält (mottagare). Ny kolumnuppsättning i `artist_profiles`: `onboarding_step`, `notify_test_email_at`, `notify_test_sms_at` (migration med RLS oförändrad – ägaren uppdaterar sin egen rad).
- Testavisering: återanvänd `sendTestSms`; ny serverfunktion för testmejl till vald mottagare (aldrig admin-Gmail), som sätter tidsstämpeln endast vid lyckat utskick.
- Ren funktion `onboardingStatus()` som räknar ut de tre tillstånden, med enhetstester (t.ex. sparat men otestat ≠ redo).
- Stilbilder: befintliga stilnamn med genererade exempelbilder i varumärkets svart/vit/violett-stil.
- SV/EN via `tx()`; Playwright-kontroll på dator 1280 och mobil 393 med en temporär teststudio som tas bort efteråt. Ingen publicering.
