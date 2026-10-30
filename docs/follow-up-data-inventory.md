# Follow-up data inventory (not implemented)

## Different length per session
Today: `artist_client_projects.session_count` + `session_minutes` (one length for all), `booking_link_session_count/_minutes`, and `bookings.session_number` + `duration_minutes`.
Needed: per-session plan rows, e.g. `project_session_plan(project_id, session_number, minutes)` or `session_plan jsonb` on the project; booking-link dedupe key must hash the full plan; `slotFits`/`sendDecision` must check each session's length; customer booking must verify the slot against that session's length on the server.

## Real draft mode in the studio page builder
Today: `artist_profiles.theme` is both edited and published; saving publishes directly. Logo/cover/background uploads save immediately.
Needed: `theme_draft jsonb` (+ `theme_draft_updated_at`), a publish action copying draft to `theme`, uploads written to the draft only, preview reading the draft, public page reading `theme` only, and a "discard draft" action.
