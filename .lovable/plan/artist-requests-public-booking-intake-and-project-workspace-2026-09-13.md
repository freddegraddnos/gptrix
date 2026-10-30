# Artist requests, public booking intake, and project workspace

## Goal
Create one connected workflow where a customer sends a tattoo inquiry to a specific studio, the inquiry becomes an **Open** project, and the studio manages it through **Open, Booked, Completed, Archived**. The customer must use an InkVision account to submit and continue the conversation.

All new interface copy will be in English. Existing AR lock and tracking logic will not be changed.

## Customer flow
1. Add a public, shareable studio link at `/boka/[studio-handle]`, suitable for Instagram and TikTok bios.
2. Show the studio identity and an intake form with:
   - name, email, phone
   - desired placement and size
   - short description
   - color or black-and-grey
   - multiple reference image uploads
3. Keep the page publicly viewable, but require sign-in before final submission. Preserve the completed form across the sign-in step.
4. When opened from an AR photo/share flow, prefill and attach the captured design, placement, size, and AR preview automatically.
5. When opened from a completed 3D scan, attach the existing private scan reference automatically; do not duplicate or expose the underlying file publicly.
6. On submit, create a studio-owned project with status **Open**, link it to the signed-in customer, and notify the studio.

## Artist/studio requests list
1. Add **Requests** as a primary section in the signed-in artist panel.
2. Show a mobile-friendly list with:
   - customer name
   - latest attached sketch/reference thumbnail
   - desired placement
   - latest activity timestamp
   - status badge: Open, Booked, Completed, Archived
3. Add search across customer/project text and filters for status and assigned tattoo artist.
4. Make every row open the project workspace.
5. Add the studio’s copyable booking link to the artist panel. Use the existing studio handle and provide a clear setup state when no handle exists.
6. Allow the studio to assign a request to one of its existing tattoo artists/team members.

## Project workspace
1. Extend the existing artist client-project view rather than creating a third project system.
2. Put customer name, email, phone, requested placement, size, color choice, assigned artist, status, and latest activity at the top.
3. Add a **Conversation** tab for customer/studio messages and attachments.
4. Require the customer to be signed in and linked to the project before reading or replying.
5. Trigger the existing email and web-push notification flow for each new project message, respecting each recipient’s notification preferences and avoiding duplicate sends.
6. Add an **Internal notes** area visible only to authorized studio members.
7. Add price and quote fields, with a clear draft/sent state. Quote changes remain studio-only until explicitly sent to the customer.
8. Retain the existing design placement, preview, before/after, and file tools as additional project sections.

## Status and booking integration
- New submissions start as **Open**.
- A project becomes **Booked** automatically only when its linked appointment/time is confirmed by the studio.
- The studio can mark it **Completed** or **Archived** from the project view.
- Existing booking approval, calendar, email, push, scan, and file-delivery behavior remains in place and links back to the project.

## Backend and access control
1. Extend the current artist client-project records with customer contact/intake data, status, assignment, quote fields, latest activity, and optional linked booking/client-project/scan references.
2. Add project attachment, conversation-message, and internal-note records with explicit grants and row-level access rules.
3. Allow only the owning studio and its active authorized team members to read/manage studio-side project data.
4. Allow only the linked signed-in customer to read customer-visible project data and conversation messages; never expose internal notes or draft quotes.
5. Store uploaded reference images and project files in private storage and serve them through authorized signed URLs.
6. Add safe server-side submission and messaging actions with validation, ownership checks, activity updates, and notification dispatch.
7. Keep the existing public preview-token flow separate so this stricter signed-in project conversation does not break old preview links.

## Verification
- Test public studio link → completed form → sign-in → submission → Open request.
- Test AR-photo and 3D-scan handoffs include the correct private attachments and metadata.
- Test requests search, status filter, artist filter, assignment, and row navigation on mobile and desktop.
- Test customer/studio conversation in both directions, including email and web-push notifications.
- Test that customers cannot access internal notes, draft quotes, other studios’ requests, or private files.
- Test confirmed calendar time automatically changes the project to Booked; then test Completed and Archived.
- Run focused tests, database security checks, type checking, build validation, and mobile browser verification.
