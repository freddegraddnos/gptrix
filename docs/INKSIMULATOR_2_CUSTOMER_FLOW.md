# Customer request flow changes

## Implemented

- A marketplace motif links directly to its existing approved creator's studio, with an explicit enquiry action distinct from digital-file purchase. AR and file purchase remain optional. No new motive rights or availability statuses are invented.
- `/<handle>/book?motif=<uuid>` keeps the selected design through login. Review displays the exact recipient, design, existing usage terms, dimensions/placement and references. Phone and reference images are optional; the brief still requires actual contact details and a description, with uncertainty choices for placement/size.
- The server verifies that the published motif belongs to the recipient, retains its ID and a frozen snapshot of name/creator/terms/placements, and includes its original detail URL in the case description. Existing marketplace `artist_id` is a studio account ID; individual `studio_artists` authorship is not fabricated.
- A stable request UUID uses the database's existing primary key to arbitrate concurrent/retried inserts. Only the winning insertion can notify. Existing requests are checked against authenticated customer and recipient, then returned unchanged; retry cannot silently overwrite the sent brief.
- References are type/size-validated before creating a case. The local draft and original File objects persist across auth/reload in per-tab session metadata and IndexedDB. Failed retention blocks departure to auth. Uploads use stable IDs and can resume against the same request; partial receipt is explicitly shown. Already-received drafts remain read-only on reload.
- `motifRequestContext.ts` holds validated non-sensitive motif/creator identity around try-on; no rendering/camera state or image rights are changed.

## Migration and deployment

Apply `0058_request_motif_context.sql` in an isolated database before deploying motif enquiries. It adds nullable provenance fields and a trigger preventing snapshot mutation; existing project access policies continue to apply. No migration was executed here. Ordinary non-motif requests do not send these new fields.

No backend calls, customer notifications or payments were made during tests. The existing notification implementation can attempt notification immediately after case creation, before optional references complete. The interface claims system receipt, not email/SMS delivery; delivery outbox/recovery is still an independent follow-up.

## Verification

`tests/requestSubmission.test.ts`: concurrent insert arbitration, retry, wrong customer/studio, file validation, route identity validation.
`tests/requestServer.test.ts`: mocked authenticated handler tests for creator validation, missing/unpublished motif, one notification on retry, other-customer key denial and immutable original brief. These are isolated mocks and do not prove deployed RLS, database triggers or external delivery.

Run additionally against an isolated Supabase instance: apply migration; simultaneous HTTP sends with one request UUID; verify one case/notification; studio A/B and customer A/B isolation; original snapshot remains after motif edit/delete; attachment failure/retry and mobile auth round trip. Physical AR regression remains separate.
