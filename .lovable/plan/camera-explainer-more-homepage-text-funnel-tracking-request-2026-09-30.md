# Camera explainer, more homepage text, funnel tracking, request read/unread

## 1. Explain the camera before the browser asks
- Before the live camera opens, show a short screen: "See the tattoo on your skin. Your camera stays on your device, nothing is recorded or uploaded unless you choose to save or share." It has one button, **Turn on camera**, and a secondary link, **Use a photo instead**.
- The browser prompt only appears after the button is tapped.
- If camera access is already allowed, the screen is skipped. If access was blocked, it shows how to allow it in iPhone and Android settings.
- This screen sits in front of the camera. The AR engine and tracking are not touched.

## 2. More homepage text (below the quotes)
- **Think it, Try it, Ink it**: three short steps. 1) Pick, create or upload a design. 2) See it on your skin in live AR at true size, or on a photo. 3) Send it to an approved studio and book.
- **FAQ**, 5 short questions in open/close rows:
  - Is it free?
  - Do I need an app or an account?
  - Is my camera image stored?
  - How accurate is the size?
  - How do I book a studio?
- Everything is real text on the page, so search engines and AI tools can read it. Same dark/violet style.

## 3. Funnel tracking
Log these moments:
- AR started
- Photo uploaded
- Design saved
- Shared
- Studio clicked

Signed-out visitors are counted too, using an anonymous id with no personal data. A simple overview goes on the admin payouts page area as a new **Funnel** admin page. It shows counts per step for the last 7 and 30 days, plus the drop-off between steps. Only you (admin) can see it.

## 4. Read/unread for studio requests
The studio inbox already has an "Unread only" filter, but InkSimulator requests are always shown as read. Only Instagram threads track this.
- New requests show as **unread** until the studio opens them.
- Each request gets a **Mark as read / Mark as unread** toggle.
- The count of unread requests shows in the studio menu.
- Admin gets a **Requests** overview listing every studio's requests with their read status. You can see which studios leave requests unopened.

## Technical details
- Camera: new `CameraPrimer` wraps the camera mount in `src/routes/ar.tsx` (and the calibrate/scan entry points). It uses `navigator.permissions.query({name:"camera"})` where supported, `localStorage` for "seen", and "Use a photo" links to `/photo-tryon`. ARCamera/LiveTryOn internals are unchanged.
- Homepage: `HowItWorks` and `HomeFaq` sections in `TryOnStartMenu` (showLogo only), using native `<details>`. No new structured-data type.
- Migration:
  - `analytics_events` (id, event text check in the 5 names, anon_id, user_id nullable, path, meta jsonb, created_at). GRANT INSERT to anon and authenticated, with an insert policy (user_id null or = auth.uid()). SELECT only via `has_role(auth.uid(),'admin')`.
  - `artist_client_projects.studio_read_at timestamptz`, which the owning studio can update under the existing ownership policies. Admin SELECT via has_role.
- `src/lib/track.ts`: fire-and-forget `track(event, meta)` called from ar.tsx mount, photo-tryon upload, save handlers (saveMyMotif / pending saver), `share.ts`, and studio links/booking buttons.
- `useStudioInbox`: `unread = studio_read_at is null`. The inbox gets a toggle button, and opening a thread marks it read.
- New admin routes `/admin/funnel` and `/admin/requests`, gated like admin.payouts (useHydrated + admin role check), with noindex head.
- Verify with Playwright at 393/1280, then check the build, types and AR tests.
