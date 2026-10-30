# Distance filter, multi-artist requests, no price filter

Three changes to "Find your tattoo artist" and the request flow.

## 1. Choose the distance yourself

Today the artist list only sorts by distance and the studio map above is fixed to roughly 15 km.

- Add a distance chooser in the filter panel: 5, 10, 25, 50, 100 km and "Any distance".
- It only applies when the location is shared; otherwise it stays disabled with the hint "Use my location first".
- The chosen distance also drives the map search above the list, and the text "Tattoo studios within ~15 km" becomes the selected distance.
- The counter reads "12 artists within 25 km" so the active limit is always visible.

## 2. Send one request to several artists

- Each artist row gets a select circle. Selecting one or more shows a bar at the bottom: "Send request to 3 artists".
- That opens the same request form as today (name, contact, placement, size, ink, description, reference images), filled in once.
- Sending creates one separate, private conversation per artist. No artist can see the others, and the customer gets one row per artist under their requests.
- Maximum 5 artists per send, so studios don't get mass mail.
- Above the send button the customer sees: "Each artist gets their own private request. They are told you are comparing a few artists, but never which ones."

### What the artist gets

The notification and email say exactly what they do today, plus one neutral line:

> The client is comparing a few artists for this idea, so a quick reply helps.

No count, no names, no city of the other artists. A single-artist request is unchanged and gets no such line.

## 3. Price filter removed

The "Max price range" buttons disappear from the filter panel. The price indicator on each artist card stays.

## Technical notes

- `ArtistFinder.tsx`: switch from `search_artists` to `search_artists_v2` (it returns `handle`, needed for sending), drop `_max_price`, add `radiusKm` state, filter results on the returned `distance_km`, add selection state and the action bar. Lift `radiusKm` into `studios.tsx` so the Places search uses `radius: radiusKm * 1000`.
- New route `src/routes/boka.multi.tsx` reusing the `/boka/$handle` form markup; selected handles are passed through sessionStorage (`inkvision.multi-request.v1`) and validated server-side.
- New server function `createArtistRequests` in `projectRequests.functions.ts`: same Zod intake schema plus `studioHandles: string[]` (1-5), loops the existing creation logic, stamps a shared `request_group_id` and `sent_to_multiple = true` on each project row, uploads each reference file once per project.
- Migration: add `request_group_id uuid` and `sent_to_multiple boolean not null default false` to `artist_client_projects` (nullable/defaulted, no backfill needed).
- Artist email keeps the existing `new-message` template; the extra sentence is appended to `preview` only when `sent_to_multiple` is true.
- Single-artist `/boka/$handle` path, age verification, deposits, bookings and the AR lock are untouched.
