# Calendar booking, multi-session projects and Google Calendar

Goal: the studio sets its availability in a real calendar view, the customer picks free times themselves once a project is Approved, several sessions per project are supported, and everyone can get the appointment into their own calendar.

## 1. Studio calendar view

- New month/week calendar in the studio panel (next to today's opening-hours settings).
- Shows every generated time: free, requested, booked, blocked.
- The studio can tap a day to open it, add or remove single times, block a whole day (holiday/sick), and change length of a time.
- Weekly opening hours stay as they are and keep feeding the calendar; the calendar becomes the place to fine-tune.
- Times already booked cannot be deleted, only cancelled (which notifies the customer).

## 2. Customer picks a time when the project is Approved

- In the project view, once the status is Approved, the customer sees "Pick your time".
- Free times from that studio are shown as a mobile day/time picker (same style as the existing booking picker).
- Choosing a time books the slot, creates the appointment and sets the project status to Booked.
- If the studio requires a paid deposit first, the time is held as "Waiting for deposit" exactly as today.

## 3. Multi-session projects

- The studio sets the number of sessions on the project (for example 3) plus length per session.
- The customer books one time per session; the project shows Session 1 of 3, Session 2 of 3, and so on.
- The project is Booked once the first session is booked; remaining sessions are shown as "still to book" with a reminder.
- All sessions appear under the customer's "Bookings" in the profile, each with its own date and status.

## 4. Customer's "Bookings" in the profile

- Project sessions appear alongside existing bookings, labelled with studio, session number and status.
- Each booking gets "Add to calendar" with: Google Calendar, Outlook / Outlook.com, Apple Calendar and iPhone/Android (calendar file). The calendar file already works — Outlook and Apple links are added.

## 5. Google Calendar for the studio (two-way)

- New "Google Calendar" section in the studio settings with a Connect button; each studio connects its own Google account.
- Outgoing: every confirmed session is written into the studio's Google Calendar and updated or removed if the time is changed or cancelled.
- Incoming: existing events in that Google calendar are read and the matching InkVision times are hidden from customers so a studio can never be double-booked.
- Sync runs when the studio opens the calendar and on the existing scheduled job (every 15-60 minutes).
- Disconnect button removes the link; nothing is deleted from Google.

## Technical notes

- Data: `studio_slots` gains `blocked` status and an `external_busy` marker for Google-derived busy blocks (source + external event id, unique per studio); `artist_client_projects` gains `session_count` and `session_minutes`; `bookings` gains `session_number`. Slot booking keeps going through the existing secure transition triggers (`protect_customer_slot_updates`) — no RLS loosening.
- Customer self-booking runs through a new server function `bookProjectSession` (auth required, verifies the caller is the project's customer, project status is `approved`, slot is free, reuses the deposit/confirm logic in `confirmArtistProjectAppointment`), so status and notifications stay identical to studio-confirmed bookings.
- Google Calendar uses the Google Calendar App User Connector (per-studio OAuth, scope `https://www.googleapis.com/auth/calendar`), with the encrypted per-user connection key storage pattern. Push to Google and free/busy read happen in server functions; a new `studio_calendar_links` table stores the connection and last sync cursor. If the connector client is not yet set up in the workspace, the section shows a setup-needed state instead of failing.
- Calendar links extend `src/lib/ics.ts` with `outlookCalendarUrl` and `office365CalendarUrl`; the existing ICS download covers Apple/iOS/Android.
- Calendar UI is a new `StudioCalendar.tsx` plus a `ProjectSessionPicker.tsx`; `ProjectWorkspace.tsx` gets the session fields and the picker. AR lock and tracking code is not touched.
- Verification: typecheck, unit tests, build, security scan and a mobile (390x844) Playwright pass over studio calendar, customer picking a time and the profile bookings list.
