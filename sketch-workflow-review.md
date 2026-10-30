# Skissflöde — kartläggning och granskningsprototyp

Granskningsadress: `/design-preview/sketch-workflow`. Datamodell/kopplingar och behörigheter/migration är separata flikar. Ingen databasändring, migration, meddelandesändning eller publicering har utförts. AR och ritmotorn är orörda.

## Verifierade kopplingar

| Yta | Faktisk lagring | Vad bevaras? | Koppling till övriga skisser |
|---|---|---|---|
| Förfrågans Sketches | `artist_client_projects` → `artist_project_sketch_versions`; privata `attachments` | Uppladdad fil, versionsnummer, kommentar, godkännande | Ingen gemensam `artist_sketches`-/ritprojektidentitet |
| Privata skisser | `artist_sketches`; privata `sketches` | Titel, anteckning, bild, artistägare | Ingen kundrelation, lageroriginal eller versionshistorik |
| Kundkoncept | `artists/clients/$id`, `artist_client_projects` | Foto, motiv, `design`/placering, before/after, preview/invite | Delar ärendetabell men inte ritverktygets ProjectFile |
| Kundens projekthistorik | `projects`, `project_assets`, `project_versions` | Kundprojekt och snapshots | Separat från förfrågans sketch-versioner |
| Ritverktygets Saved sketches | IndexedDB `ritstudio-projects`, `projects` + `versions` | Full `ProjectFile`: lager, mått och mmPerPixel; högst 20 lokala versioner | Ingen studio-/ärende-/molnrelation i posten |
| Save to My designs | `myMotifs` i localStorage; `syncMyMotifs` → `user_designs`, privata `designs` | Platt PNG, inte redigerbara lager | Inte promotion av IndexedDB-projektet; separat motivkopia |
| Ritning till bokning | `paintHandoff` → `saveArtworkToBooking`; `booking_files`, `attachments`, slot-tidslinje | PNG + `.inkproj.json` som två filposter | Slot-bunden leverans, inte privat ärende-/arkivsave |

Källor: `ArtistSketches.tsx`, `SketchesTab.tsx`, `useArtistRequests.ts`, `useArtistMode.ts`, `useProjectWorkspace.ts`, `PaintApp.tsx` 1294–1375, `projectStore.ts`, `project.ts`, `paintHandoff.ts`, `paintBookingSave.ts`, `myMotifsSync.ts`, `projectRequests.functions.ts`, `sketchShare.functions.ts`; databasens faktiska kolumner, buckets, RLS och SQL-funktioner lästes utan kundinnehåll.

## Konstaterade gränser och luckor

- `createSketchVersion` anropar `notifyProjectParty`; bokningsleverans skriver tidslinje och anropar `notifyBookingFile`. Ingen av dessa är en säker privat-sparväg.
- Versionsradernas SELECT använder `is_artist_project_party`, som inkluderar ärendets kund. Det finns inget explicit delningsfält på versionen. Nuvarande modell uppfyller därför inte automatisk uppdelning mellan privata arkivversioner och kunddelade versioner.
- `sketch_share_by_token` väljer final-version eller senaste versionsnummer. Delningslänken är inte låst till en uttryckligen vald version. `readSharedSketch` signerar dess fil via privilegierad klient.
- Privata skisser skyddas idag av `auth.uid() = artist_id`, inte ett gemensamt arkiv för alla behöriga studiomedlemmar.
- Alla aktuella buckets är privata, men privat bucket betyder inte att kunden saknar åtkomst till ärendets versionsfiler.
- `Save to My designs` bevarar inte lageroriginalet. Ingen migration får hävda att ett platt PNG kan återskapa lager.

## Föreslagen datamodell

1. `studio_sketch_documents`: en stabil `id`, serverhärledd `studio_id`, titel, taggar, kroppsdel, skapad/ändrad och head-revision. Arkivet och ärendet öppnar samma ID.
2. `studio_sketch_request_links`: `sketch_id` → `request_id` i `artist_client_projects`, samma studio valideras på servern. Ingen länk = generell skiss utan kund.
3. `studio_sketch_versions`: immutable `id`, `sketch_id`, versionsnummer, `original_path`, `preview_path`, hash, skapare och serverdatum. Befintligt ProjectFile/inkproj-format och skala bevaras.
4. `studio_sketch_shares`: vald `version_id`, ärende, mottagare, delnings-/återkallelsedatum. Kundåtkomst gäller endast platt förhandsvisning av uttryckligt delad version; originalet förblir privat. Godkännande/kommentar knyts till samma version.
5. Lokal återhämtning/outbox: konto/studio/sketch-ID, basrevision, lokal skrivtid och väntande operation. Metadata ligger utanför ritfilen. Versionskonflikt får inte lösas med tyst överskrivning.

## Föreslagen behörighetsmatris

| Åtgärd | Behörig personal A | Studio B | Ärendets kund |
|---|---|---|---|
| Läsa original/privata versioner | Ja, arbetsrättighet krävs | Nej | Nej |
| Spara privat | Ja, aldrig meddelande | Nej | Nej |
| Länka ärende | Endast samma studio | Nej | Nej |
| Dela vald version | Explicit handling + rättighet | Nej | Nej |
| Läsa delad PNG | Ja | Nej | Endast mottagarens delade version |
| Skriva över sparad/delad snapshot | Nej, skapa ny version | Nej | Nej |

Kontroller ska finnas i autentiserade serverfunktioner, RLS, privata storagevägar och realtidsläsning. Servern härleder medlemskap/rättighet; klientens studio-ID, kund-ID och växlar är inte behörighetsbevis. Nya tabeller behöver GRANTs och RLS. Privilegierad signering kräver validerad version/ärende/mottagare. Tokenlänkar måste vara versionbundna och återkallningsbara. Privat save får inte skapa meddelanden/aviseringar.

## Återanvändning / migration

Återanvänd ProjectFile-serialisering, PNG-export, IndexedDB, säkert returnTo, befintliga ärende-ID:n och medlemskontroller samt StudioPrimitives. Migration krävs för de nya kopplingarna, metadata, original-/previewversioner och explicit kunddelning samt tillhörande RLS/storage/realtid/serverläsning. Det är ett förslag, inte införda regler.

Import ska vara uttrycklig, källspårad, idempotent och kontrollsummerad. Behåll gamla filer tills återöppning och mått verifierats. Lokal import kräver ägarens enhet. Historiska delningar behöver verifierad leveranshistorik; okända fall markeras för manuell granskning, inte automatiskt massdelas eller tyst fråntas befintlig åtkomst. Inga riktiga skisser har migrerats.

## Sparstatus

Privat utkast → lokalt återhämtat/väntande → sparar → serverbekräftad privat version → uttryckligen delad bestämd version. Offline/fel får aldrig visas som arkivsparat. Lokal skrivning kan också misslyckas; då finns arbetet bara i öppna fliken. Visa datum, retry och bevarad basrevision; delning kräver serverbekräftad version. Prototypens arkiv och delning är simulerade och tydligt märkta, utan serveranrop.

## Rättning och tester

- Verklig kundkonceptmärkning använder nu `client_user_id` för kopplingsstatus: saknat visningsnamn + kopplat konto visas som `Customer · linked`, inte `No client linked · linked`. Ingen kunduppgift skrevs om.
- 7 regeltester godkända: privat save utan meddelande/kundåtkomst; immutable delad v1 efter privat v2; studio B nekas save/share; offline/fel skapar inga arkivversioner; generell skiss saknar kund och kan inte delas till ärende; arkivsökning med alla efterfrågade fält; relation utan namn.
- Klickflöde godkänt: ärende → rita teststreck/ändra metadata → spara privat → kundtomvy → välj v1 → bekräfta simulerad delning → privat v2 → synkfel/retry → arkivets samma original → rätt ärende → offline → reload → lokal återhämtning.
- Inga page errors; ingen horisontell överskridning vid 390/320 px. Skärmbilder i `/tmp/browser/sketch-workflow/`.
- Tester bevisar prototypens modell, inte framtida produktionsbehörigheter. A/B/kund-RLS, signerade filer, realtid, faktisk molnsynk, revisionskonflikter och verkliga ritfiler måste testas efter godkänd modell i isolerad miljö.
## Omgång 2 — konflikter, flikar, kommentarer, migration och återställning

**Nya prototypregler (13 tester godkända, `src/lib/sketchWorkflowPrototype.test.ts`):** samma `sketch-a` nås från ärende och arkiv; flik B med gammal basrevision får konflikt och skriver inte över flik A; offline skapar ingen arkivversion; interna anteckningar/lager följer inte med en delad version (kunden får bara platt bild + titel); kundkommentar binds till en uttryckligen delad version och nekas på privata versioner; studio B nekas.

**Tillstånd:**
| Läge | Visas | Får |
|---|---|---|
| Offline | "Offline · bara på denna enhet" + lokal tid | Rita, spara lokalt. Inte dela |
| Synkfel | "Synk misslyckades · inte i arkivet" + Försök igen | Behåller basrevision och utkast |
| Versionskonflikt | "En annan flik/enhet sparade version N" | Välj: spara mitt som ny version / öppna senaste / jämför. Aldrig tyst överskrivning |
| Dubbla flikar | Samma som konflikt vid spar; varning när annan flik har osparade ändringar (BroadcastChannel) | — |
| Återhämtning | "Lokalt utkast från [tid] hittades" | Återställ / avstå; märks aldrig "Sparat i studions arkiv" |

**Migrationsutkast:** `docs/sketch-archive-migration.draft.sql` — **inte tillämpad**. Additiv: befintliga tabeller orörda. Versioner saknar UPDATE/DELETE-policy (oföränderliga). Kunden läser endast egen aktiv share-rad; kommentar kräver att share och version matchar.

**Åtkomsttester (att köra i isolerad miljö med Studio A, Studio B, Kund C, Kund D):**
1. B läser/skriver A:s dokument, versioner, länkar → 0 rader / nekad.
2. B länkar A:s skiss till B:s ärende eller A:s ärende → nekad.
3. C läser versioner som inte delats → 0 rader; begär signerad fil för original eller odelad preview → nekad.
4. D använder C:s delningstoken eller share-id → nekad; återkallad token → nekad.
5. C kommenterar v2 via v1:s share → nekad.
6. Privat spar → 0 rader i notifications och artist_project_messages.
7. UPDATE på delad version → nekad.

**Återställningsplan:** 1) Ögonblicksbild/backup före import. 2) Import i batchar med `source/source_id` (idempotent) och kontrollsumma; gamla filer och tabeller lämnas kvar. 3) Läsvägar bakom flagga; gamla vyer fungerar parallellt. 4) Rollback = stäng flaggan och ta bort importerade rader via `source` — originaldata påverkas inte. 5) Historiska delningar importeras endast med verifierad leveranshistorik; oklara markeras för manuell granskning.

**Slutligt godkännande kräver:** integrationstest på två enheter samt de negativa behörighetstesterna ovan. Inget av detta är utfört; ingen produktionsdata migrerad.
