# Client management for the studio

Give the studio a real client list in the studio panel — one row per person, not per project — where the studio can edit the client's details, hide a client from the list, or end the relationship. Also let the studio rename each client conversation.

## Client list (new page in the studio panel)

A new **Clients** page reachable from the studio panel, next to Requests.

Each row shows:
- Client name (studio's own label if it has set one, otherwise the name from the booking)
- Username, email or phone when available
- Number of projects and the date of the latest activity
- Status: Active, Hidden or Ended

Tools on the page:
- Search by name, username, email or phone
- Filter: Active / Hidden / Ended / All (default Active)
- Tapping a client opens its projects, each linking into the existing project view

## Edit, hide, end

Per client, from a sheet:
- **Edit** — change display name, email, phone and add a private note only the studio sees. Editing never changes the customer's own account, only how the studio sees them.
- **Hide** — removes the client from the default list without touching projects or messages. Reversible from the Hidden filter.
- **End relationship** — marks the client as Ended: the client disappears from the active list, and open projects for that client are archived. Existing messages, sketches and bookings stay intact and readable. Reversible ("Reopen").

Ending a relationship does not delete anything and does not cancel a paid deposit or a booked session; the studio is told so in the confirmation.

## Rename a conversation

In each project's conversation, the studio can set its own title (for example "Sleeve – second session"). The title shows in the project view, in the requests list and in the client's project list. The customer keeps seeing the original project title unless the studio renames it; the rename is studio-side labelling.

## Technical notes

- New table `public.studio_clients`: `studio_id`, `client_key` (client_user_id when linked, otherwise normalised email/phone/name), `client_user_id`, `display_name`, `email`, `phone`, `note`, `state` (`active` | `hidden` | `ended`), timestamps, unique on (studio_id, client_key). GRANTs + RLS scoped through `is_studio_staff`.
- New column `artist_client_projects.conversation_title` (nullable text), writable by studio staff only, enforced by the existing `protect_artist_project_client_updates` trigger path.
- Clients are derived by grouping `artist_client_projects` per studio on the same key, then left-joined with `studio_clients` for overrides — no backfill needed, rows are created on first edit.
- Server functions in `src/lib/studioClients.functions.ts`: `upsertStudioClient`, `setStudioClientState` (archives that client's open projects when ended), `renameProjectConversation`. All verify studio staff server-side.
- New route `src/routes/artists.clients.list.tsx` plus `src/hooks/useStudioClients.ts`; the existing project-oriented `/artists/clients` page stays as is.
- AR lock and tracking untouched.
