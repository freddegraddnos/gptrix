# Motif sales, studio approval and cleaner designs

Seven pieces of work. The AR lock, OpenCV matching and deposits stay untouched.

## 1. Buy a design end to end and check it lands everywhere

Run a real purchase in the gallery with the test card, then confirm:

- the buyer sees it under "My designs" and can download it,
- the studio that made it sees the sale in their panel and gets a notification,
- a bought design is no longer watermarked anywhere.

Anything broken along that path gets fixed in this step.

## 2. Studios sell their own drawings and texts

The "List a design" page today only takes a file upload. It gets a second way in: pick
something you already made in InkVision — a drawing, a lettering piece or a saved design —
and list it with a price or as a free design. Same watermark rules as today.
A "Sell a design" button is added to the studio panel so the page is easy to find.

## 3. Clients can join and buy without being a studio

Sign up, sign in and buy a design works for a plain client account: no studio profile is
created, nothing artist-only is shown, and pressing Buy while signed out takes you to
sign-in and then straight back to the design you were buying.

## 4. Hidden studio signup at /adminsignup

A page that is not linked anywhere and not indexed. It creates the account and the studio
profile immediately — no email confirmation, no approval — and lands on the studio panel.

## 5. Normal studio signups need your approval

A new studio can sign up, sign in and fill in its profile as usual, then presses
"Ask to join". That sends a request to 1891frs@gmail.com with the studio name, city,
contact details and a link to the profile, plus Approve and Reject buttons that work
straight from the email without signing in (each link is a one-time secret).

Until you approve, the studio is not searchable, not on the map and cannot take bookings;
they see a clear "waiting for approval" note in their panel. Approving publishes them and
emails them the good news; rejecting emails a short note instead. Accounts created through
/adminsignup skip all of this.

## 6. Twelve new designs

Twelve added across patterns, mandala and realistic. Each one is cleaned before it goes in:
white and near-white areas become fully transparent so only ink shows in AR, with soft edges
kept so lines don't turn jagged.

## 7. Tighter frames on every design

Several designs sit inside a much larger empty frame, which makes the centimetre size look
wrong — a 12 cm design can render at 8 cm of actual ink. Every design image is cropped to
the ink itself with a small even margin, and the stored width in cm is kept meaningful, so
what you set is what you get on the skin and in AR.

## Technical notes

- Migration (additive): `artist_profiles.approval_status` text default `pending`,
  `approval_requested_at`, `approval_token` text, `approval_token_used_at`, `approved_at`,
  `approved_by`. Existing rows are backfilled to `approved` so no live studio disappears.
  `search_artists_v2` / `public_artist_page` gain an `approval_status = 'approved'` filter.
- `src/lib/studioApproval.functions.ts`: `requestStudioApproval` (authenticated; generates a
  token, mails 1891frs@gmail.com via `sendTemplateEmail`), plus a new
  `studio-approval-request` and `studio-approval-result` email template in
  `src/lib/email-templates/` registered in `registry.ts`.
- `src/routes/api/public/studio-approval.ts`: GET with `token` + `action`, constant-time
  token compare, single use, returns a small confirmation page.
- `src/routes/adminsignup.tsx` + `src/lib/adminSignup.functions.ts`: server function uses the
  admin client inside the handler to create the user with `email_confirm: true`, inserts the
  artist profile with `approval_status = 'approved'`, then the client signs in normally.
  `noindex` head, no links to it anywhere.
- `src/routes/shop.new.tsx`: source toggle (upload vs pick from `listUserDesigns` /
  `listMyMotifs`), reusing the existing marketplace upload and pricing code.
- Motifs: one-off Pillow pass over `src/assets/tattoo-*.png` — alpha-bbox crop, uniform 3%
  margin, re-saved at the same paths so every import keeps working; new motifs generated,
  run through the same white-to-transparent + crop pass, then registered in
  `src/lib/tattoos.ts`.
- Verify: `npx tsgo --noEmit`, `bun test`, `git diff --check`, build, security scan, and
  Playwright at 393px over buy → my-designs → studio sales, /adminsignup and the approval
  request.
