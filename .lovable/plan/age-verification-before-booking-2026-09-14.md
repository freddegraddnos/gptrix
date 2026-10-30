# Age verification before booking

Let a studio ask a client to prove they are old enough, before a time can be booked. First version uses a photo of an ID, checked by the studio. BankID is not included.

## How it works

1. In a project, the studio presses **Request age verification**. They can add a minimum age (default 18).
2. The client sees a clear card in their project view: "The studio needs to verify your age before booking." They take or upload a photo of their ID.
3. Only the studio team can open the photo, through a short-lived private link. The client can replace it before it is reviewed.
4. The studio presses **Approve** (and enters the date of birth shown) or **Reject** with a reason.
5. On approval the photo is deleted immediately. Only "verified", the reviewed date and the year of birth are kept. On rejection the photo is also deleted and the client can submit a new one.
6. Once approved, a green "Age verified" badge shows on the project for the studio, and booking proceeds as normal.

## Booking gate

While a verification request is pending or rejected, booking a time on that project is blocked with the message "Age verification required before booking." This applies to the client's own time picker, proposed times, and the studio's confirm-time action. If the studio never requests verification, nothing changes.

## Privacy

- ID photos live in a private area, never public, never in a shared link.
- Deleted the moment the studio approves or rejects.
- The client is told in plain English what is stored and that the photo is deleted after review.
- Text is English throughout.

## Technical notes

- Migration: `artist_project_age_verifications` (project_id, requested_by, min_age, status open/submitted/approved/rejected, storage_path, birth_year, reviewed_by, reviewed_at, reject_reason, timestamps), unique on project_id, RLS through `is_artist_project_party` (client can read own + insert own submission; only studio staff can review). Plus `artist_client_projects.age_verification_status` for cheap gating.
- Storage: private bucket path `project/{projectId}/age-id/{uuid}` with signed URLs (5 min) for staff only; server deletes the object on approve/reject.
- Server functions in a new `src/lib/ageVerification.functions.ts`: `requestAgeVerification`, `submitAgeVerification`, `reviewAgeVerification`. Notifications reuse `notifyProjectParty` (in-app + push + email).
- Booking gate added inside `confirmArtistProjectAppointment` and the client slot-booking path in `projectSessions.functions.ts`, so it cannot be bypassed from the UI.
- UI: a compact card in `ProjectWorkspace.tsx` above the tabs — studio side shows request/review controls, client side shows upload. No new tab.
- The AR lock (flowLock / lockPoseController / ARCamera) is not touched.

## Later (not in this change)

BankID needs an external provider account (Criipto, Scrive or Signicat) with a monthly fee. When you have one, the same card gets a "Verify with BankID" button that fills in age automatically with no photo at all.
