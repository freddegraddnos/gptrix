# Roadmap

- [x] Build five Swedish search pages: fineline, Roman numerals, realistic tattoos, animal tattoos and creating tattoos; optimise existing AI/text/AR metadata, link pages internally and include in sitemap/prerender. All pages returned 200, desktop/mobile images and overflow checked; text/create/library navigation and AR motif URL verified; sitemap includes all five and build OK. Actual camera rendering was not verified. Not published.

- [x] Apply Fredrik's concrete homepage typography, colours and dimensions; Anton/Bodoni Moda/IBM Plex Mono/Inter confirmed loaded, 390/430px screenshots inspected, language persistence/four destinations/navigation scroll verified and build OK. Copy, original portrait, routes and AR preserved; not published.
- [x] RESTORED 2026-10-16 (second request): Fredrik asked for the even older homepage "the one with the glow around the text". HomePosterPage.tsx and the .home-poster CSS block were restored to the October 12 version (commit 225eefc5) — glowing purple subhead text, glowing primary CTA, old three-line intro copy, Anton headline with text-stroke. Verified at 390px with Playwright: glow text-shadows active, no pageerrors, no horizontal overflow. Only the homepage was restored; all later studio/tooling work untouched.

- [x] Correct homepage reference fidelity: natural scrolling composition, source-refined homepage logo, condensed textured headline, Bodoni serif and image-led spacing; rendered 390/430 px, language persistence and four destinations checked without runtime errors. Exact target portrait unavailable; retained existing woman/tattoo. Studio/AR untouched, not published.

- [x] Match the October 14 homepage reference with the existing woman, serif subheading and homepage-only styling; checked SV/EN at 320–430 and 1280 px, all four links and no runtime errors. Studio/AR unchanged; not published.

- [x] Replace existing InkSimulator page logos and app icons with the uploaded official artwork; homepage, studio overview, guide, login and brand page checked, plus mobile homepage without overflow. Build OK; studio-owned logos and AR unchanged, not published.

- [x] Stencil step 3: pure-white paper, physical screen rulers and ink-based motif sizing; 18 tests passed, authenticated desktop/mobile flow and A4 300 DPI PDF checked with a 150 mm motif. Line engine and AR unchanged; physical printing unverified, not published.

- [x] Remove 5% commission claims from all SV/EN page copy, accounting labels and search-facing content. English overview, guide, setup, pricing and About checked in Dark/Bright, with no runtime errors; 13 pricing/calculator tests passed. Billing and historical amounts unchanged; not published.

- [x] For studios: retained headline/calculator/mobile CTA; added current test-data screenshots of studio-page controls/session booking, estimated time-value and approved 2026 no-commission trial terms, plus new-studio/manual navigation. Checked SV/EN at 1280/1440/390/320 and 20 tests; no publication or payment logic changes.

- [x] Unify the existing studio overview, guides, login and authenticated workspace with the approved black/white/violet profile; preserve all content, links, flows, data and AR.

- [x] Simplify the studio overview to verified benefits and one anonymized tabbed product-image area; retain first-viewport headline/calculator, optional assistant and existing calculator rules.

- [x] Audit the five approved studio chains with read-only checks and existing isolated prototype tests; report unverified data-write boundaries, concrete errors and a two-persona user test plan without sending messages or publishing.
- [ ] Complete end-to-end question/answer, visibility, role and assistant booking tests — blocked on an isolated data environment with outbound messages and payments disabled.

- [x] Build and verify an isolated studio page builder prototype with shared content across style packages, section controls, responsive preview and honest publication boundaries; do not change production.
- [x] Consolidate the approved page-builder controls into the real Profile & look editor, retire the competing preview entry, expose logo and Dark/Bright in the workspace shell, and mark the booking agent optional without changing saved settings.
- [x] Restore the reference For Studios header with visible Dark/Bright, align the studio Go to surface, and introduce `/<handle>/book` while preserving old booking links.

- [x] Rename the old For Studios feature page to Guide, match the supplied layout, move the setup walkthrough, and verify all bilingual routes

- [x] Add bilingual studio-interest pages linked from the new studio overview, enlarge the guide link, retain detailed feature pages, verify and publish

- [x] Implement the approved bilingual studio time calculator and reference layout without changing the guide or SEO heads
- [x] Verify calculator rules, persistence and studio-page layout at 320/360/390 px in both languages

- [x] Include the booking image in both customer and studio booking emails and verify rendering

- [x] Restore /for-studios Swedish and English text verbatim against the original specification and discrepancy list; preserve approved design and later demo button text
- [x] Rework studio presentation in English and Swedish, retain a separate studio guide, and validate mobile and desktop presentation
- [x] Fable studio navigation: 6 text categories, Go to button beside title, one shell (same back button/top bar) for every studio page
- [x] Verify the new studio shell in Dark/Bright at 393/754/1280 px

- [x] Keep All sections beside Overview on every width and preserve Requests
- [x] Move studio address to Profile and build a stepwise account guide
- [x] Apply Dark/Bright and homepage-inspired typography across studio pages
- [x] Link artist booking notices to protected details for standard and agent bookings
- [x] Verify studio flows and permissions at mobile, tablet and desktop widths
- [x] Restore legacy Swedish studio-login routing and reliable studio request details with return navigation and explicit access states
- [x] Remove calendar exports only from artist selection and add studio approval response choices
- [x] Require customer image and motif size across booking request flows
- [x] Replace public studio self-signup with an email-only interest form
- [x] Add editable save/open and stronger motif contrast to Sleeve Builder
- [x] Correct drawing-template scale, editing overlay order, and export exclusion
- [x] Restyle all app and sign-in emails to the black/white/violet profile

- [x] Fix all open security findings
- [x] Publish site + submit IndexNow ping for /for-studios.md and /llms.txt (key 1630265fe0251e2242672d4b9d015dc8)
- [x] MCP: agent booking tool that saves request to studio panel + sends notifications
- [x] Studio approval email with one-click sign-in → choose password → panel
- [x] Own booking texts (confirmation + reminder, sv/en) used in SMS, email and reminders
- [x] /studios card: logo, page fallback for "Web", agent button
- [x] Studio page appearance (layout, bg dark/light/image, accent with contrast check, fonts + own font file, cover) with live preview
- [x] Studio panel: left menu with icons, collapsible, mobile bottom bar, new Overview
- [x] Refine studio dashboard flow and left navigation for desktop, tablet and mobile
- [x] Make unread notifications and studio customer preview reachable from the panel
- [x] Move Sell a design out of Profile & look and repair background image upload feedback/save
- [x] Restore guide-step return navigation and readable Dark/Bright studio sections without changing AR or customer pages

- [x] Create page reworked to the approved stacked-card layout (bild 07), all six destinations preserved
- [x] Library page reworked to the approved Discover layout (bild 09): search, style chips, shortcuts, 2-column cards
- [x] Library zero-result state: clear search & filters button and network-error state with Try again (bild 16)
- [x] Studio search reworked to list-first with search, All locations/Near me, List/Map toggle and Filters (bild 11); cards show Approved studio + Explore studio →; map and waitlist preserved
- [x] AR view: motif gallery handle above the motif strip (bild 13), searchable gallery with style filters (bild 14)
- [ ] Motif preview card before AR (bild 15) — separate decision, not started
- [x] Review step 4: library detail offers camera or photo try-on, chosen motif follows to both
- [x] Review step 5: profile grouped into My motifs / Try-ons / Requests / Account
- [x] Review step 6: drawing tool first step = A4/A3 paper + start/import/body template, exact mm & dpi under Advanced
- [x] Visual system A–H pilot: shared heading/button/field/selected-state utilities applied to Create, studio request, For studios — awaits approval before wider rollout

- [x] Set the studio calculator default to 15 minutes and use the approved base time wording in both languages
- [x] Rebuild the regular homepage from the approved bilingual poster reference, with a blonde tattoo portrait and violet tattoo corner markers; preserve all destinations and lower-page content
- [x] Correct only the customer homepage accent, tattoo markers, reference typography, action labels/icons and spacing; retain violet studio pages
- [x] Match the uploaded homepage type reference exactly: two-line main heading and single-line pink-violet subheading
- [x] Match the homepage first mobile viewport to the supplied reference; use the written marker placement and center the portrait more
- [x] Make the homepage tattoo corner markers thinner and fainter so the imperfect placement stays unobtrusive
- [x] Add the Swedish homepage "No download / No cost" lines to the English homepage in English

- [x] Studio mode label ("Studioläge · name") on desktop/mobile, distinguishing panel, published page and preview; preview cannot send requests
- [x] Block customer actions for studio accounts with explanation and return path (UI only; server rules already enforce)
- [x] Complete SV/EN for the customer journey (home → try/photo/library/create intros) and the whole studio panel; never translate customer text or names
- [x] Separate agent customer language from studio interface language
- [x] English interest form: three steps + no-account notice; rename public "Get started" nav to connected-studio manual; consistent URL/lang strategy and html lang
- [x] Click through SV/EN journeys (home → try intro, For studios → panel); no English empty views in Swedish panel

- [x] Build dark/bright studio component sample and reuse presentation on Private sketches, Client concepts, Request, Profile & look, Agent, Availability and Calendar sync; preserve business logic and public custom themes.
- [x] Capture before/after and verify contrast, keyboard focus, 1440/390/320 px and enlarged text without publishing.

- [x] Map sketch storage/connections and propose model, permissions, reuse/migrations without changing real sketches.
- [x] Build isolated request-to-archive version prototype with synthetic data and negative tests; correct client relation label.
- [x] Inventory and regroup mobile drawing navigation without removing functions; verify 320/390 px portrait/landscape, touch, keyboard, local save/reopen and origin return; retain engine, scale and AR. Physical iOS/Android, advanced effects, AI and actual printing remain unverified, documented in the review report.
