# InkSimulator 2.0 — source inventory

This inventory describes the supplied source at the start of the work. “Present” means implementation exists in the source; it does **not** mean that an end-to-end journey, external service or camera has been verified. The detailed setup, baseline checks and current changes are reported separately. Review real configuration and RLS in an isolated environment before enabling changes or sending messages.

## Customer journey

| Area | Source evidence | Status and remaining work |
| --- | --- | --- |
| Home and navigation | `HomePosterPage`, `BottomNav`, routes under `src/routes` | Present; review customer paths and bilingual copy in a browser. Keep the homepage and logo within the boundaries in `AGENTS.md`. |
| Discover motifs | `shop.index.tsx`, `useMarketplace`, `motifPlacement.ts` | Present: search and filters from loaded motifs, style, category, placement and coverage. Assess actual datasets, empty results, navigation and scroll restoration. |
| Discover studios and contact | `artists.search.tsx`, `ArtistFinder`, `ArtistPublicProfile` | Present: approved studio search, profile and direct-message/request paths; real authentication and delivery need isolated integration tests. |
| Marketplace detail → AR | `shop.$id.tsx` sends motif ID to `/ar`; `ar.tsx` loads marketplace motif | Present in code. Separate digital-file sale from an artist accepting tattoo work. Detail has no direct artist/studio request action carrying the selected motif. |
| Saved idea → request | `ideaContext.ts`, `useIdea`, `IdeaBar`, `$handle.book.tsx` | Partial: saved project ID is held in sessionStorage; size and placement populate the request. The book route accepts `idea` but not a marketplace motif ID. Verify immutable contents received by the studio and whether artist-level identity survives. |
| Request without creation or AR | `artists.search.tsx`, `$handle.book.tsx` | Contact route exists, but the request form requires an image or saved project. A direct motif enquiry needs a truthful, supported server-side handoff; do not claim a motif was included just from UI state. |
| Request delivery and retries | `$handle.book.tsx`, `projectRequests.functions.ts` | Needs improvement: request is created and notification initiated before file validation/upload finishes. Upload failure can leave an existing request while the UI reports failure; another submit can create a duplicate. A robust fix needs server-side idempotency and clear retry/partial-upload states. Do not exercise real notifications. |
| Photo try-on | `photo-tryon.tsx` | Present; unauthenticated save navigates to `/auth` without an explicit return destination. Photo/form recovery across authentication, reload and failure is not established. |
| Local and account designs | `myMotifs.ts`, `myMotifsSync.ts`, `paint/projectStore.ts`, `sketch-workflow-review.md` | Partial: My designs syncs a flattened PNG; the drawing editor separately stores editable `ProjectFile` versions in IndexedDB. The PNG is not a layered document. Distinguish device, account and explicit share. |
| Request draft | `$handle.book.tsx` | Partial: form fields are put into sessionStorage on submit. Files are in component state, so recovery after navigation/reload is not established. The active idea handle is session-scoped rather than a complete persisted composition. |
| Privacy and snapshots | `projectRequests.functions.ts`, `sketch-workflow-review.md`, Supabase migrations | Existing private paths and authorization code exist; review points out that current sketch-share links select latest/final version, not an immutable chosen version. Cross-user, RLS, signing, revocation and sent snapshot tests are required. |

## Studio and integrations

| Area | Source evidence | Status and remaining work |
| --- | --- | --- |
| Studio sign-in | `StudioLoginPortal.tsx`, `useStudioAccount`, `artists.dashboard.tsx` | Actual Supabase password authentication and dashboard route exist. Verify existing studio, new studio, partial onboarding and unauthorized user with isolated accounts. |
| Onboarding and daily work | `studioOnboarding.ts`, `studioOnboarding.functions.ts`, `artists.dashboard.tsx`, `studioNav.ts` | Existing onboarding status and dashboard tabs. Evaluate whether completed forms disappear from everyday view and existing studios avoid forced re-entry. |
| Modules | `studioNav.ts`, `artists.dashboard.tsx` | Navigation is defined by fixed tabs, including sales/Fortnox; inspect persistence and safe defaults before asserting module behavior. Concealing a tab is not authorization. Existing usage, history and obligations must survive changes. |
| Studio staff, content and customer cases | `StudioMembersManager`, `StudioTeamManager`, `StudioGalleryManager`, `StudioInbox`, `projectRequests.functions.ts` | Existing pieces; verify studio/member permissions and preserve artist linkage instead of assuming one artist per studio. |
| Payments and Fortnox | `FortnoxCard`, `payments.functions.ts`, marketplace checkout | Existing integrations, not verified in this environment. A selected module is not evidence of a connected integration. Keep existing commission snapshots and avoid real payments. |
| Public studio and availability | `$handle.index.tsx`, `$handle.book.tsx`, `StudioPublicSections`, `StudioAvailabilityManager`, `studioCalendar.server.ts` | Stable public studio/book routes and slot management exist. Public section labels a claim as a request pending studio acceptance. Verify current availability, concurrency/atomic server rules, empty state and artist/location; opening hours are not availability. No live booking tests. |
| Notifications | `projectRequests.functions.ts`, `bookingNotify.server.ts` | Existing email/SMS paths; a created record is not proof of delivery. Use isolated service doubles and never send real customer messages during validation. |

## Creation, AR and 3D

| Area | Source evidence | Status and remaining work |
| --- | --- | --- |
| Creation | `paint/PaintApp.tsx`, `paint/projectStore.ts`, text renderer and existing AI/stock/upload routes | Existing tools and local editable project store. Validate allowed material rights, layer persistence and handoffs; do not treat a flattened export as an editable project. |
| AR | `ar.tsx`, `DeepARViewer`, `MediaPipeViewer`, `ARCamera`, `CameraPrimer`, `deepar.ts` | Multiple engines/fallback are already wired. Protect these and their routing, state, image transparency, CSS and camera lifecycle. A successful build is not physical-camera regression evidence. Inspect full AR dependency map separately. |
| 3D | `Model3DViewer.tsx`, `scans.$id.tsx`, `scan3d.functions.ts` | A real GLB viewer uses Three.js GLTFLoader and OrbitControls, including load error handling. It is wired to personal scans; a public gallery of real artist 3D projects is not established by that viewer alone. Scan reconstruction uses KIRI and `KIRI_ENGINE_API_KEY`; no key or provider result is assumed. Do not present a video or flat sleeve editor as a 3D model. |

## Cross-cutting and validation

- `seo.ts`, `vite.config.ts`, sitemap and public route heads implement SEO infrastructure; individually verify metadata and rendering for public content. Keep private and admin content out of indexes.
- `uiLang.ts` and `i18n/sv.ts` provide translation infrastructure; check both languages for each changed flow, including meaning of body-part “back”.
- `track.ts` and existing analytics events are present; do not log private images, text or contact details, and do not conflate a click with a delivered request or booking.
- Existing source has tests in `tests/`, including `ideaContext`, `studioOnboarding`, `studioBookingLinks` and AR geometry/lock tests. Passing a build or a unit test does not prove RLS, external delivery, 3D reconstruction or camera behavior.
- For each complete journey, verify the intended data, recipient, authorization, error handling and return path in an isolated environment. Remaining external integrations and physical mobile testing must be reported separately.
