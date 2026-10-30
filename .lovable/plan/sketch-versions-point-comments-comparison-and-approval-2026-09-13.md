# Sketch versions, point comments, comparison and approval

## Goal
Add a shared **Sketches** tab to the existing project workspace for both studio users and customers. Every upload becomes an immutable numbered version, can be reviewed visually, annotated at an exact point, compared with another version, and approved as the project’s final design.

## User experience
- Add **Sketches** alongside Conversation, Files, Notes and Quote in the existing mobile project view.
- Show the selected version large at the top, then a horizontally scrollable thumbnail strip labeled **Sketch 1, Sketch 2, …** with uploader, date and required change comment.
- Render images directly. Render supported 3D files in the existing interactive 3D viewer; use a clear file fallback if a browser cannot preview a format.
- Let both the customer and authorized studio/team members upload a new image or 3D version. The upload action stays disabled until a short “What changed?” comment is entered.
- Never overwrite or renumber an earlier version. Concurrent uploads receive the next number safely.
- Clicking the enlarged image places a numbered pin at that image-relative point and opens a required comment input. For 3D, reuse the viewer’s surface raycast so the pin stays attached to the model. Show the selected version’s pin thread below the preview.
- Add a compare mode where any two versions can be selected. Reuse the existing side-by-side visual language, with two image/3D preview panes and independent 3D controls.
- Add **Approve this version** below the preview. Per your decision, either the customer or an authorized studio/team member can approve it.
- Approval marks exactly one version as final, records who approved it and when, and changes project status to **Approved**. Previously uploaded versions and their comments remain available.

## Project statuses
Use the ordered workflow:

```text
Open → Sketch in progress → Changes requested → Approved → Booked → Completed → Archived
```

- Add **Sketch in progress** and **Changes requested** between Open and Booked in status selectors and filters.
- Add **Approved** for the final-design action.
- Keep the existing rule that confirming a calendar time sets the project to **Booked**.
- Manual status changes remain studio-only; the approval action is shared by customer and studio.

## Data and access
- Add a dedicated immutable sketch-version table linked to `artist_client_projects`, storing version number, private storage path, media type, original name, required change comment, uploader, timestamps and approval metadata.
- Add a dedicated annotation table linked to a version. Store normalized 2D coordinates for images and 3D surface coordinates for models, plus author, comment and timestamp.
- Add a project-level final-version reference so the approved design is unambiguous.
- Apply explicit grants and row-level rules: only the linked customer and authorized studio/team members can read, upload, annotate or approve; no anonymous access.
- Enforce append-only versions in the database: no update/delete path for uploaded version content, unique `(project_id, version_number)`, and server-side atomic numbering.
- Keep files private in the existing project storage area and issue signed preview URLs only to project participants.
- Accept common browser-previewable images plus GLB/GLTF 3D assets, with existing upload-size safeguards adapted for larger 3D files.

## Implementation
- Add authenticated server actions for atomic version creation, signed file access, point comments and approval/status transition. Validate project membership server-side for every action.
- Extend the workspace loader/types to return sketch versions, annotations and final-version state.
- Build focused Sketches components for upload, viewer, thumbnail strip, pins, compare selection and approval; mount them in the shared `ProjectWorkspace` so artist and customer views stay consistent.
- Update request lists/status filters and customer status displays to recognize the expanded status set.
- Send the existing in-app, web-push and email notifications when a version is uploaded, a point comment is added, changes are requested, or a version is approved. SMS remains outside scope because no SMS provider is connected.
- Leave AR lock/tracking logic untouched.

## Verification
- Add deterministic tests for sequential/parallel version numbering, immutability, membership checks, single-final-version approval and status transitions.
- Test image pins at multiple viewport sizes and 3D surface pins after rotate/zoom.
- Test image↔image, image↔3D and 3D↔3D comparisons on mobile and desktop.
- Test both customer and studio upload/comment/approval paths, signed-file access, notifications and the confirmed-time transition from Approved to Booked.
- Run type checks, focused tests, build, runtime/error checks, database/security linting and a final diff check before completion.
