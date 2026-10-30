# Studio requests, session booking, admin control and studio galleries

Four parts, built in this order. The AR lock is untouched.

## Part 1 — Requests from Community must reach the studio

What I found: every studio in the app is identified by a short public name ("handle") when a request is sent. Right now **neither of the two studios in the database has one** (0 of 2). That means the "Send request" button is hidden on the studio card, and any request that does go through cannot find the studio and fails with "Studio not found".

Fix:
- Give every studio a public name automatically (generated from the studio name, kept unique), and let the studio and the admin change it.
- Make the request work even if the public name is missing, by sending to the studio's account directly.
- After sending, show a clear confirmation and create the conversation, so both sides see it immediately.
- Verify end to end: send a request from Community as a customer and confirm it appears under the studio's Requests, with in-app and email notification.

## Part 2 — Sessions and a calendar link for the customer

The studio already can set number of sessions and minutes per session; the customer side exists but there is no link to send.

Add:
- In the project view the studio sets sessions and length, then presses **Send booking link**. The customer gets it by email and notification.
- The link opens a month calendar: the customer picks day and time for each session, one at a time.
- Times that are already booked, held, or marked busy in the studio's Google Calendar are not selectable. The booking is taken with a last-moment check so two customers can never take the same time.
- Each booked session sets the project to Booked and appears under the customer's Bookings with an add-to-calendar link.

## Part 3 — Admin view for studios (only 1891frs@gmail.com)

New page `/admin/studios`, reachable only for your admin account:
- List all studios with search.
- Create a studio, edit every field (name, public name, city, address, website, Instagram, styles, description, opening hours, coordinates).
- Upload, replace and delete studio images (logo/cover and gallery photos).
- Remove a studio (with a confirmation step; the studio disappears from search and the map).

## Part 4 — Studio gallery and artists visible to customers

The studio panel already has Gallery and Team tabs. What is missing is that customers actually see them.

- The studio card in Community and on the map gets a **View studio** action opening the public studio page.
- That page shows the artists (portrait, name, role) and the gallery of finished tattoos, filterable per artist, plus Message and Request booking.
- Empty states when a studio has not uploaded anything yet.

## Technical notes

- Handle backfill as a migration (unique, slugified from studio name) plus handle editing in `studioProfile`/admin functions; `insertArtistRequest` gets a studio-id path in addition to `public_artist_page`.
- Booking link: token-based route (reuses the existing project session flow), server function issues the link and sends it with the existing notify/email pipeline.
- Availability filtering reuses `studio_slots` plus the existing Google busy sync (`studioCalendar.server.ts`), and keeps the atomic `status = open` claim in `bookProjectSession`.
- `/admin/studios` uses server functions guarded by `has_role(admin)` and the service-role client, same pattern as `/admin/verification`; images through the existing studio media bucket.
- After each part: `bun test`, `tsgo --noEmit`, build, and a mobile-viewport check of the touched screens.
