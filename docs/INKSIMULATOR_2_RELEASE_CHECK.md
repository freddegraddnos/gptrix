# Release verification — 2026-10-30

Verified source commit: `4fcbdb83` on `upgrade/inksimulator-2`.

This check completes the local build/browser checks that were previously blocked by the approval-review usage limit. It supersedes those pending items in the earlier delivery report; other deployment and physical-device limits remain.

## Passed

- Full `npm run build`, exit 0: client, server and configured public prerender pages.
- Customer navigation in Chromium: English/Swedish home, direct artist discovery, studio login → real signup with preserved dashboard redirect, existing motif links, no horizontal overflow at 320/390/1440 px, no page errors.
- Mocked public motif → correct studio intake: selected motif/studio and tattoo-offer metadata are reviewed before login; received-request state hides current mutable offer and unsent summary. No enquiry was submitted.
- Real IndexedDB recovery: editable photo placement survives reload; stable project identity is retained until acknowledgement; acknowledgement cannot delete newer work; explicit local deletion works.
- Real GLB render in Chromium: invalid file rejected, actual GLB rendered, rotate and zoom change rendered pixels, keyboard controls work, and closing releases the canvas.

No app source changes were required by these checks.

## Isolation and artifacts

The build and fresh local dev server used loopback Supabase URLs and the non-secret `local-validation-only` publishable value. Browser scripts blocked external requests and used clearly synthetic backend fixtures where needed. No production database was contacted, no real message or payment was sent.

**The generated `.output` is a local-test build and must not be deployed.** The hosting build must inject the target environment's real configuration. Build success does not establish that target database migrations, auth redirects, credentials or external integrations are configured.

Dev server port 8080 was already occupied, so these tests used the newly started isolated server on 8081. The three scripts with hardcoded local URLs ran via equivalent in-memory source with only port substitution; all assertions and network guards were retained. The navigation script used its existing `INK_TEST_URL` setting.

Durable logs under `/workspace/verification`:

- `release-build.log`
- `release-navigation.log`
- `release-tattoo-offer.log`
- `release-photo.log`
- `release-model.log`

Physical mobile camera/AR regression and real target Supabase/auth/storage/integration checks remain outstanding. Additive database migrations 0057–0060 must be validated and applied to the intended target before enabling the new database-backed workflows.
