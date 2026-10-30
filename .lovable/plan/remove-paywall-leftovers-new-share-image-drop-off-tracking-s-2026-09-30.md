# Remove paywall leftovers, new share image, drop-off tracking, studio section

## What I found
- The "STEG 2 AV 3" screen with the 14:58 timer, "Lås upp — 28 kr/mån" and Stripe/Apple Pay buttons no longer exists in the code. What remains: the `/paywall` and `/subscribe` addresses (now just redirect home), the old plan list (1 day / 1 month / 1 year), an unused plan checkout component and its payment function, and an invite page comment mentioning the paywall.
- The homepage sets no share image, so link previews use an automatic screenshot of an old build — that is where the paywall still shows.
- The site's own analytics (funnel events in the database, viewable at /admin/funnel) is the analytics tool already in place, so no Google Analytics is added.
- /for-studios already defaults to English (Swedish only for Swedish browsers) and contains no Gmail address.

## 1. Remove the paywall completely
- Delete the `/paywall` and `/subscribe` pages, the plan checkout component, the plan checkout payment function and the old consumer plan list/prices. Studio pricing (299 kr / 2 999 kr) and design purchases stay.
- Fix the invite page comment; keep its redirect to home.
- Homepage "free web app" text and structured data (price 0) stay; double-check they match.
- Final reply lists every file/line that referenced the paywall.

## 2. New share image
- Create a 1200x630 PNG: InkSimulator logo, a tattoo shown in AR on an arm, violet/black style, English only, no timer or prices. Save to `/public/og-inksimulator.png`.
- Homepage gets og:image and twitter:image as `https://inksimulator.com/og-inksimulator.png`, plus og:image:width 1200, og:image:height 630, English og:image:alt; twitter:card stays summary_large_image.
- The old screenshot is set by hosting, not in code; the new tags override it after publishing. Link previews may need a refresh in each platform's debugger.

## 3. Drop-off tracking (no personal data, anonymous id only)
- Camera: `camera_prompt_shown` (primer screen shown), `camera_granted`, `camera_denied`.
- Try-on: `tryon_started` (design picked / photo loaded), `tryon_completed` (design saved or shared).
- Booking: `booking_started` (booking dialog opened), `studio_contact_clicked` (email/phone/website/Instagram link on a studio), `booking_completed` (request submitted OK).
- Comment block in the tracking file listing where each event fires. /admin/funnel updated to show these three funnels.

## 4. Top bar
- "Studio login" becomes "For studios" linking to /for-studios (homepage bar and the start menu link). "Login" unchanged.

## 5. /for-studios
- Keep English default + Swedish-browser rule; make the switch a clear "ENG | SWE" toggle in the top right with the active language highlighted.
- Contact links use phone `tel:+46793288098` (your choice until the studio mailbox works). Confirm no personal address remains.

## 6. Homepage section for studios
- New block below the FAQ, visually separated (different surface, top border, own heading), e.g. "Built for tattoo studios", with three lines:
  - 78% of tattoo regrets are about size and placement — details are everything.
  - Save time: no more printing stencil after stencil. Stencils are a work tool, not a preview.
  - More customers: thousands of visitors create tattoo projects here — let them send you requests.
- Button "For studios" to /for-studios.

## Technical details
- Tracking uses existing `track()` in `src/lib/track.ts`; migration widens the `analytics_events.event` CHECK list to the eight new names (old names kept).
- Files: `src/routes/paywall.tsx`, `subscribe.tsx` (delete), `src/components/StripePlanCheckout.tsx` (delete), `src/utils/payments.functions.ts`, `src/lib/access.ts`, `src/routes/i.$code.tsx`, `src/routes/index.tsx`, `src/components/TryOnStartMenu.tsx`, `CameraPrimer.tsx`, `photo-tryon.tsx`, `ARCamera`/`LiveTryOn` pick handlers only (no AR engine changes), `myMotifs.ts`, `BookingDialog.tsx`, studio profile pages, `for-studios.tsx`, `admin.funnel.tsx`.
