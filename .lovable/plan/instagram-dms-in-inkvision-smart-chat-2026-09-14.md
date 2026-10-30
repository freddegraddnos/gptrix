# Instagram DMs in InkVision + smart chat

Studios answer Instagram DMs inside InkVision, send sketches and time suggestions from the same place, and get an AI-suggested booking whenever a time is mentioned.

## 1. One inbox for all messages

A new **Inbox** page in the studio panel, next to Requests and Clients.

- One list with every conversation: Instagram threads and InkVision project chats side by side, newest first, each tagged with its source.
- Opening a thread shows the full history and a reply box. Replies to Instagram threads are delivered as real Instagram DMs.
- Search across sender name and message text; filter by source (All / Instagram / InkVision) and unread.
- Any Instagram thread can be turned into a project with one button. The thread stays linked, so the conversation continues in the same place and everything already built (sketches, deposits, calendar) works from there.
- Instagram allows a reply only within 24 hours of the customer's last message. The thread shows the remaining time and, once it expires, explains that the customer has to write again.

## 2. Smart chat actions

Three buttons above the reply box, in both Instagram threads and project chats:

- **Send sketch** — picks a sketch version from the linked project and sends both the image and a link that always shows the latest version. The link needs no login, works in Instagram, and can be switched off per project.
- **Suggest a time** — picks free slots from the studio calendar and writes them into the message as plain text. For customers with an InkVision account it also creates a real time proposal they can accept with one tap.
- **Invite to InkVision** — sends the studio's booking link so the customer can move into a full project.

## 3. AI booking suggestion

Every incoming and outgoing message is read by AI for a date and time.

- When a time is found, a card appears above the reply box: "Book Saturday 14 March, 14:00 — 2 h" with **Book** and **Dismiss**.
- Book runs the normal booking path: the slot is created in the studio calendar, pushed to Google Calendar when connected, the project becomes Booked, and the customer is notified. Deposit rules still apply.
- Nothing is ever booked without the studio pressing Book. The card also warns when the time collides with an existing booking.
- The same card is shown for times the customer writes in an InkVision project chat.

## 4. What you need to do at Meta (checklist)

Instagram has no ready-made connection in Lovable, so you register one app at Meta. This takes about 15 minutes.

1. The studio's Instagram account must be a **Professional account** (Business or Creator) — Settings → Account type in the Instagram app.
2. Go to developers.facebook.com → My Apps → Create app → use case **Other** → type **Business**.
3. In the app, add the product **Instagram** → "Instagram API setup with Instagram login".
4. Under API setup, copy the **Instagram app ID** and **Instagram app secret**.
5. Add this as the redirect URI: `https://inkvision.app/api/public/instagram/callback`
6. Add this as the webhook callback URL: `https://inkvision.app/api/public/instagram/webhook`, subscribe to the field **messages**, and pick any verify token text (you give me the same text).
7. Send me: app ID, app secret, verify token. I store them as secrets — they are never visible in the app.
8. While the Meta app is in development mode only accounts you add as testers can be used. For all studios, Meta requires App Review for `instagram_business_manage_messages`, which typically takes a few days.

Until those three values exist I build everything, and the Instagram parts stay behind a "Connect Instagram" button that shows a setup-needed state.

## Technical notes

- Per-studio connection via Instagram Login for Business (scopes `instagram_business_basic`, `instagram_business_manage_messages`). New table `studio_instagram_links` (studio_id, ig_user_id, username, encrypted long-lived token, expires_at, updated_at), service-role only, reusing `connectionKeyCrypto.server.ts` like `studio_calendar_links`. Token refresh (60-day long-lived token) runs in the existing scheduled job in `api/public/booking-reminders.ts`.
- `src/routes/api/public/instagram/webhook.ts`: GET answers `hub.challenge` against the verify token; POST verifies `X-Hub-Signature-256` HMAC with the app secret before touching the payload, then stores messages. `src/routes/api/public/instagram/callback.ts` handles the OAuth code exchange and long-lived token swap.
- New tables `instagram_threads` (studio_id, ig_thread_id, participant id/name/avatar, last_message_at, window_expires_at, project_id nullable) and `instagram_messages` (thread_id, direction, ig_message_id unique, body, attachment_url, created_at), both RLS-scoped with `is_studio_staff`. Sending goes through a server function that posts to the Graph API `/{ig-user-id}/messages`.
- Public sketch link: new route `src/routes/s.$token.tsx` plus a `share_token` on the project, served by a SECURITY DEFINER function that returns only the latest approved-or-newest sketch version — no login, revocable, no other project data exposed.
- AI extraction: one server function per message using Lovable AI (`openai/gpt-6-astra` via the gateway Responses API, streamed and consumed server-side) with a strict schema `{ found, startsAt, durationMinutes, confidence }` in the studio's timezone. Result is cached on the message row so a thread is analysed once. Booking reuses the existing `bookProjectSession` / studio-manual booking path and `pushBookingToGoogle`.
- AR lock, tracking and camera code are untouched.

## Out of scope

- SMS.
- Facebook Messenger and WhatsApp (same Meta app could add them later).
- Instagram comments and story replies — DMs only.
