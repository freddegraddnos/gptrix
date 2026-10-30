# Map fix, designs saved to your account, motif sales and a client panel

## 1. A real map in "Find your tattoo artist"

Google blocks the map key on inkvision.app, which is why the grey "Oops! Something went wrong" box appears. Instead of waiting for that key setting, the map is drawn on our own server and sent to the page as an image:

- A server call fetches a dark-styled map picture centred on the search area with a numbered pin for every studio found, matching the numbers in the list below it.
- Tapping a pin number in the list, or the map itself, opens that studio in Google Maps.
- Panning and zooming are replaced by zoom in/out buttons and "Use my location"; the studio list and filters keep working exactly as today.
- If the interactive map key ever starts working again, the page still prefers the live map and only falls back to the picture.

## 2. Your drawings and texts are kept in your account

Today designs live only on the device. After this, when you are signed in:

- Every design you draw, write as lettering, upload or generate is also saved to your account.
- Signing in on a new phone brings them all back; signing out and back in loses nothing.
- Signed out it still works as today (kept on the device only) and those designs are uploaded the next time you sign in.
- Each design can be renamed or deleted, and deleting removes it from the account too.

## 3. Buying a motif reaches the artist

When a client buys a motif in the gallery:

- The purchase is recorded as an order for the artist who uploaded it.
- The artist gets a notification (in the app and by email) and a new "Sales" list in the studio panel: motif, buyer, price, date, and a running total for the month.
- The buyer's copy is unlocked immediately — no watermark — while everyone else still sees the watermarked version.

## 4. Client panel: "My designs & purchases"

A new page for clients, reachable from the account card on the start page:

- Tabs for Purchased motifs, My drawings and My lettering.
- Each item shows a preview with the name and date, and a Download button that saves a clean, full-resolution PNG (purchased motifs download without the watermark).
- Items can be renamed, deleted, or sent straight to AR / the sleeve builder.

## Technical

**Map** — `src/routes/studios.tsx`: keep `useJsApiLoader`, but when `gm_authFailure` fires (or the key is absent) render `<StaticStudioMap />` instead of the fallback card. New server fn `staticStudioMap` in `src/lib/studios.functions.ts` calls `GET {GATEWAY_URL}/maps/api/staticmap` (Static Maps API is still authorised on the managed key) with `size=640x640&scale=2`, dark `style=` params matching `MAP_STYLE`, and `markers=label:1|lat,lng` per studio; returns a base64 data URL so no key reaches the browser. Inputs validated (max 20 markers, zoom 5–17, bounded lat/lng). No browser Places calls are added; search still goes through the existing `searchText` server fn.

**Account designs** — migration: `public.user_designs` (id, user_id → auth uid, name, kind text check in drawing/text/upload/ai, storage_path, width_cm numeric, created_at) with GRANTs for `authenticated`/`service_role`, RLS `auth.uid() = user_id` for all four verbs; private storage bucket `designs` with owner-scoped policies on `storage.objects`. New `src/lib/userDesigns.functions.ts` (`listUserDesigns`, `saveUserDesign` (data URL → PNG upload), `renameUserDesign`, `deleteUserDesign`) behind `requireSupabaseAuth`; signed URLs on read. `src/lib/myMotifs.ts` stays the local cache and gains a `syncMyMotifs(userId)` used on sign-in: pushes local rows that have no `remoteId`, pulls remote ones missing locally, stores `remoteId` on each `MyMotif`. `saveMyMotif` fires the upload in the background when a session exists.

**Sales** — extra RLS policy on `motif_purchases`: artists may SELECT rows whose `motif_id` belongs to a `marketplace_motifs` row they own (via a SECURITY DEFINER helper `owns_motif(uuid, uuid)`). The payments webhook (`src/routes/api/public/payments/webhook.ts`) already upserts the purchase; add a `notifyUser` call to the motif's artist after the upsert. New tab in `src/routes/artists.dashboard.tsx` fed by a `useMotifSales` hook (join purchase → motif → buyer profile).

**Client panel** — new route `src/routes/my-designs.tsx` under the existing auth handling, combining `useMarketplace(user.id)` filtered to `owned`, and `listUserDesigns`. Download uses the signed URL / unwatermarked storage path via `fetch` → `Blob` → anchor. Linked from `AccountCard` in `src/components/TryOnStartMenu.tsx`. Own `head()` metadata.

Verification: `npx tsgo --noEmit`, `bun test`, build, security scan after the migration, and a Playwright pass at 393px on `/studios`, `/my-designs` and the studio panel. AR lock, OpenCV matching and the deposit flow are untouched.
