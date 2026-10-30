# SEO component, studio guide order, analytics, studios empty state, crawler readability

## Current state (checked)
- No `r2.dev` reference exists in the code. The old preview screenshot is added by the hosting when a page has no share image; giving every page our own image removes it.
- `/about` already exists; it will be updated, not duplicated.
- No prerendering is configured yet (build tool version supports it).
- `/sitemap.xml`, `robots.txt` (www Sitemap line), `/llms.txt`, first-party `track.ts` and a studio waitlist component already exist and will be extended.

## 1. Shared SEO helper
- New `seo()` helper returning title, description, canonical, og:url, og:type, twitter:card and default share image `https://www.inksimulator.com/og-inksimulator.png` (1200x630, width/height/alt), all absolute www URLs. Optional breadcrumb.
- Applied to /, /for-studios, /studios, /ar, /photo-tryon, /pricing, /create, /library, /discover, /generator, /tattoo-font-generator, /artists (+ /about).
- New titles/descriptions:
  - /ar: "Live AR Tattoo Try-On — Free, No App | InkSimulator", description about true 1:1 scale (no "millimeter accuracy").
  - /create, /library, /discover, /generator: unique titles in the /photo-tryon style.

## 2. /for-studios "Included in your plan"
New order: client demand (try in AR, then send requests) → bookings, calendar & deposits → own studio profile & SEO → SMS notifications → Fortnox integration → Posture Pro. Existing texts kept; the two first rows reuse existing wording. "Prices shown in SEK" added next to prices here and on /pricing. No price changes.

## 3. Analytics events (existing first-party tracker)
Events: ar_opened, camera_prompt_shown, camera_granted, camera_denied, design_selected, tryon_started, photo_uploaded, design_saved, share_clicked, studios_viewed, studio_contact_clicked, booking_started, booking_completed, for_studios_cta_clicked, studio_request_submitted, signup_started, signup_completed. Comment at each firing spot; list in README. Database rule widened to accept the new names. No personal data (anonymous device id only).

## 4. /studios empty state
When nothing is within 15 km: show the nearest approved studio at any distance with "X km away" and a link; keep "Notify me" (city + email) with a clear success message. Live cities listed automatically from approved studios' cities (no invented list). Filter and map unchanged.

## 5. Crawlers and AI agents
1. Prerender /, /for-studios, /pricing, /studios, /ar, /photo-tryon, /about to static HTML at build. Add 60–100 words of visible intro on /ar and /photo-tryon (styled like existing page text).
2. Sitemap: all public routes, www URLs, `lastmod` only from real dates (studio profile update time); static pages without fake dates per sitemap rules. robots.txt already correct.
3. JSON-LD: Organization + WebSite on all pages (root); SoftwareApplication (price 0) + FAQPage matching the visible homepage FAQ exactly; Service/Offer on /pricing (299 SEK/mo, 2,999 SEK/yr, 5%); BreadcrumbList on inner pages. Existing /for-studios data reused, not duplicated.
4. /llms.txt rewritten: short description, key URLs with one line each, pricing facts, contact email, last updated date.
5. /about: stable facts (what, who, pricing, contact, last updated); footer link added.
6. IndexNow: generate a key, publish `/public/<key>.txt`, and tell you the key.

## Open item
- Contact email for /about and llms.txt: studios@inksimulator.com isn't receiving mail yet. I'll use the phone number +46 79 328 80 98 plus studios@inksimulator.com unless you name another.

## Technical details
- `src/lib/seo.ts` helper merged into each route's `head()`; JSON-LD via `scripts`.
- `vite.config.ts`: `prerender: { enabled: true, autoStaticPathsDiscovery: false }` with listed pages; data-dependent sections still load client-side.
- Migration: replace `analytics_events` event CHECK constraint with the new list (legacy names kept).
- Nearest studio: compute haversine over `listApprovedStudios` results client-side.
