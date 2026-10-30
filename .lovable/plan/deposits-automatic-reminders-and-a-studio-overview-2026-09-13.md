# Deposits, automatic reminders and a studio overview

Three additions to the studio side: take a deposit to lock in a booking, send reminders automatically, and show a monthly business overview.

## 1. Deposit per project

- In the project view the studio gets a **Deposit** section: set an amount in SEK and press **Send payment link**.
- The customer sees the amount and a **Pay deposit** button in the same project view, and pays by card through the existing checkout.
- Status shows as **Not paid** / **Paid** for both sides, with the paid date. Each project has one deposit; the studio can change the amount or cancel it while it is unpaid.
- Money is collected into the InkVision account for now (payouts to studios handled outside the app). Until the live payment setup is finished, deposits run in test mode with the test card.

## 2. Per-studio rule: deposit required before confirmed

- New switch in the studio's own settings: *Booking counts as confirmed only when the deposit is paid*. Off by default.
- When it is on and a deposit is unpaid, confirming a time marks the appointment as **Awaiting deposit** instead of Confirmed; it flips to Confirmed automatically the moment the payment lands. Studios with the switch off keep today's behaviour.

## 3. Automatic reminders

Extends the existing scheduled reminder job (runs every 15-60 minutes, no new setup needed):

- **24 hours before the session** — reminder to the customer.
- **Unpaid deposit** — reminder to both customer and studio while a deposit is still unpaid and a session is coming up (sent at most once a day, and once more 24 h before).
- **Sketch not approved 48 h before the booked time** — reminder to both customer and studio.

All reminders use the existing channels (in-app, push, email), respect each person's notification settings and quiet hours, and are never sent twice for the same event.

## 4. Studio overview in the admin panel

New **Overview** view in the studio panel, above today's insight lists:

- Bookings per month (last 12 months) as a simple bar chart, with a month picker.
- Revenue per month: deposits paid plus quoted project value, shown in kr.
- Returning customers: how many customers have more than one booking, and their share of all customers.
- How many of those customers came in through inkvision.app — counted from projects that started in the public booking page or app flow versus ones the studio entered manually.

## Technical notes

- New `project_deposits` table (project, studio, amount, currency, status, Stripe session/payment intent, timestamps) with RLS limited to the project's customer and the studio team; `artist_profiles.require_deposit_for_confirmation boolean not null default false`; `artist_client_projects` gains an acquisition source flag set when a request comes from the public `/boka/$handle` form.
- Deposit checkout reuses `src/lib/stripe.server.ts` + embedded checkout with `kind: "project_deposit"` metadata; `src/routes/api/public/payments/webhook.ts` gains a branch that marks the deposit paid and, when the studio's rule requires it, confirms the linked booking and sets the project to Booked.
- Reminder logic is added to `src/routes/api/public/booking-reminders.ts` using `notify.server.ts` with per-event idempotency keys and new `*_reminder_sent_at` columns.
- Overview is a new component on `src/routes/artists.insights.tsx` fed by a `SECURITY DEFINER` aggregate function scoped to `is_studio_staff`.
- Deposit amounts are validated server-side; AR lock/tracking code is not touched. SMS remains out of scope.
