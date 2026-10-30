# Publish the design gallery + approve studios from email

## 1. A real gallery clients can browse and buy from

Today `/shop` is a "coming soon" page — uploaded designs are never shown. It becomes the live gallery:

- Grid of all published designs, newest first, with the design image, name, studio name, style and either a price in kr or a "Free" tag.
- Search box plus style chips (Blackwork, Fineline, Geometric, Traditional, Botanical, Minimal, Realism, Japanese…) so clients can narrow down.
- Paid designs keep the full-cover InkVision watermark until bought; free designs show clean.
- Tapping a design opens it: bigger preview, description, "Try in AR", and **Buy for X kr** (card payment, same test-card setup as deposits) or **Save** if it is free.
- After buying, the watermark disappears, the design lands in "My designs" for download, and the studio sees the sale in its panel (already wired).
- Shop link becomes visible in navigation so the gallery is reachable.

## 2. Uploading: name, style, price or free

The "Share a design" form gets a required **Style** picker next to name and price, and clearer wording: choose Free or set a price, give the design a name and a style. Only studios you have approved can publish to the gallery; a pending studio sees a short note and the Ask to join button instead.

## 3. Approve or reject studios from the email

The approval email to 1891frs@gmail.com gets two equally visible buttons — **Approve studio** (green/dark) and **Reject** — instead of one button and a text link. Both still work once only.

Pressing Approve publishes the studio immediately: it appears in "Find your tattoo artist" and on its public page, and the studio gets a mail that it is live. Reject keeps it hidden and sends a polite decline. The flow after that is unchanged: a studio signs up, fills in its profile, presses "Ask to join", and stays hidden until you decide.

I will send myself a test request and click both buttons to confirm the studio really shows up in the artist search afterwards.

## Technical notes

- Migration: add nullable `style text` to `marketplace_motifs`; tighten the INSERT policy so `artist_id = auth.uid()` **and** the user's `artist_profiles.approval_status = 'approved'`.
- `src/routes/shop.tsx` rewritten as the gallery using the existing `useMarketplace` hook; new `src/routes/shop.$id.tsx` detail route with `StripeEmbeddedCheckout` + `createMotifCheckout` (test env) and head meta.
- Prices shown in the gallery regardless of `MARKETPLACE_LIVE`; flag left alone elsewhere.
- `src/routes/shop.new.tsx`: style select from `TATTOO_STYLES`, style written to the new column, approval gate.
- `src/lib/email-templates/studio-approval-request.tsx`: second `Button` for reject; `api/public/studio-approval.ts` unchanged apart from copy.
- Verify with tsgo, bun test, build and a 393px Playwright pass over the gallery, the detail page and the upload form. AR lock, deposits and booking flow untouched.
