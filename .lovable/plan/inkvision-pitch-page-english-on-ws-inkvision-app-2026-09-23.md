# InkVision pitch page (English) on ws.inkvision.app

A short, compressed web version of the pitch deck: five sections, each with a horizontally scrollable row of cards so a reader can swipe through the detail without a long page.

## Top of the page

Poster-style hero in the same look as the InkVision flyer — black background, cyan accent, big bold type:

- One-liner: **Try the tattoo before it is permanent.**
- Support line: AR try-on, 3D body scan and a global tattoo marketplace — built social first.
- Small line: "THINK IT — TRY IT — INK IT" and Fredrik Sjoqvist, Founder · Stockholm.
- Buttons: "Open the app" and "Get in touch".

## The five sections

Each section is a short heading plus a row of cards you swipe/scroll sideways (with arrows on desktop).

1. **The problem** — 3 cards: end customer (permanent decisions made in the chair), artist (~60 min per client on stencil fitting), studio (bookings scattered across DMs, mail and calls).
2. **The product** — 6 cards: AR simulator, 3D body scan, vote & share, prank cam, marketplace, booking with deposits and payments.
3. **For artists** — 4 cards: Instagram DMs in one inbox, AI proposing real times from Google Calendar, deposits and payments end to end, 3D scan before the client arrives.
4. **Traction & market** — cards: 8 artists signed, 0 said no, 1 week of outbound, ~60 min saved per client, plus NOW Stockholm / NEXT Nordics / THEN Europe & US.
5. **Model, edge & founder** — cards: 10% on bookings & deposits, 10% on design sales, 10% on local application; why competitors only own one piece; Fredrik Sjoqvist's background.

Closing strip: "Nobody should regret their tattoo." with clickable phone **+46 79 328 80 98** and email **1891frs@gmail.com**.

All copy comes from your deck — nothing invented. English only.

## Getting it on ws.inkvision.app

1. I make the app serve this page at the root of that host, so `ws.inkvision.app` opens it directly. `inkvision.app` and `www.inkvision.app` are untouched.
2. You connect `ws.inkvision.app` as a domain for the project — the DNS record has to be added at your domain provider, I cannot do that part.

Until then the page lives at `inkvision.app/investors`.

## Technical notes

- New route `src/routes/investors.tsx` with its own `head()` (unique title/description, `robots: noindex`).
- Card rows: `overflow-x-auto snap-x` flex rows with `shrink-0` cards, existing design tokens and shadcn components — no new dependencies.
- Host check (client-side only) redirects `/` to `/investors` when the hostname is `ws.inkvision.app`.
- No backend changes; AR lock, camera pipeline and existing flows untouched.
- Verification: `bunx tsgo --noEmit`, `bun test`, build, plus a browser pass on mobile and desktop widths.
