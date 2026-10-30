# Seven improvements: sleeve textures, motif sales, request history, map and speed fixes

## 1. Own sleeve designs on a scan

Today the sleeve wrap only works with one fixed design image.

- An "Upload your own sleeve design" button appears above the three sliders on a scan.
- The picked image is wrapped onto the scanned body part using the existing UV mapping, and Start position / Rotation / Coverage work exactly as now.
- The image is saved to the client's My designs, so it can be reused on any later scan (picker lists saved designs next to the upload button).
- Studios get the same upload in their own gallery: a sleeve design they add there can be loaded onto a client's scan instead of the fixed image.

## 2. Selling motifs in the gallery

- Studios upload a motif, give it a name, tags and a price, and choose Paid or Free (free is for marketing and behaves like today's designs).
- Paid motifs are shown with a repeated "INKVISION" watermark across the whole image — in the gallery, in AR try-on and on saved or shared photos — until that buyer has paid.
- Buying uses the same card checkout as deposits (test mode, money collects with InkVision until live payouts are set up). After payment, the watermark is gone for that buyer and the motif behaves like any owned design.
- Studios see their own motifs with price, free/paid state and sales count in the studio panel.

## 3. Comparison request history for studios

- A "Request history" view in the studio panel lists every request that has come in, newest first, with client, placement, date and status.
- Requests the client sent to several artists carry a "Comparing artists" tag — never which artists or how many.
- Filters: all / comparison requests only, plus a date range. Each row opens the project.

## 4. The map showing "Oops! Something went wrong"

The map key exists in the project, so the error comes from Google rejecting the request at runtime — most likely the site address is not allowed for that key, or billing is not active on it. First step is to reproduce the page and read the exact Google error, then fix accordingly (allow the app's addresses on the key, or switch the mini-map to the static preview we already use in list rows). While the map cannot load, the studio list shows a clean fallback card with a "Open in Google Maps" link instead of the Google error box.

## 5. Remove a motif by holding it in the AR strip

- Press and hold a motif in the bottom strip: it lifts slightly and a small confirm appears ("Remove from strip?").
- Removing deletes your own uploaded/drawn motif from the strip; built-in designs are hidden from the strip for you instead of deleted, with an "Undo" toast.

## 6. Home screen needs two taps

Needs reproducing first: the likely causes are the whole page waiting for the sign-in check before anything is tappable, or the card animation swallowing the first tap on touch. Plan: measure the first tap on a phone-sized view, then make the cards respond to the first touch and render the menu without waiting on the account lookup (the account card fills in when it is ready). Target: one tap navigates immediately.

## Technical notes

- Sleeve upload: new prop-driven texture source in `Model3DViewer` replacing the fixed `sleeveDesignUrl`; saved designs via existing `myMotifs` storage plus a studio sleeve kind in `studio_gallery`.
- Marketplace: extend `marketplace_motifs` with `price_ore` usage, `is_free`, and a `motif_purchases`-backed `owned` check in `useMarketplace` (currently hardcoded `owned: true`). Watermark applied client-side over unowned paid motifs and baked into export/share canvases. Checkout reuses `createCheckoutSession` + the payments webhook, adding a `motif_purchase` kind.
- Request history: read-only view over `artist_client_projects` using existing `request_group_id` / `sent_to_multiple`; no schema change.
- Map: diagnose via browser console on `/studios`; fallback path already exists for list rows.
- Long-press: generalise the existing `onCustomLongPress` handler in `ARMotifStrip` to every tile.
- Home: profile the first interaction with Playwright before changing `TryOnStartMenu` / `index.tsx`.
- AR lock and OpenCV tracking untouched. All new copy in English.
