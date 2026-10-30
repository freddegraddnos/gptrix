# Get out of the drawing studio again

Today `/rita` fills the whole screen and has no way back: no back arrow, no app menu, no bottom navigation. The only exits are "Try in AR" (which leaves with the sketch) or the browser's back button. This adds a proper, always-visible way out.

## What gets added

**1. An exit button first in the top toolbar**

A back-arrow button placed as the first item in the existing top-left toolbar cluster (before "Canvas and scale"), so it sits in the same panel the artist already uses and does not cover the canvas. On narrow screens it stays icon-only.

Tapping it opens a small menu with the places an artist actually wants to go:

- Home (try-on start)
- Designs library (pick another motif)
- AR camera
- My bookings
- Stay in the studio (dismiss)

**2. Don't lose the sketch**

If there are unsaved strokes, leaving first shows a short confirmation with three choices: *Save to My designs and leave*, *Leave without saving*, *Stay*. Saving reuses the existing "My designs" save, so the sketch can be reopened in the studio later. With an empty canvas the confirmation is skipped and it just navigates.

If the studio was opened from a booking (the "Save to booking" state), the confirmation also mentions the booking so nothing is dropped by accident.

**3. Smarter default destination**

- Opened from a booking or project → the back button returns to that project page.
- Opened from the library or the start menu → returns there.
- Otherwise → the menu above.

## Technical notes

- All changes live in the top-bar section of `src/components/paint/PaintApp.tsx`, plus a small `ExitStudioMenu` component under `src/components/paint/`.
- Return destination is read from the existing handoff module (`src/lib/paintHandoff.ts`) — the save-target already stored there identifies the booking; a new optional `returnTo` path is stored by callers that navigate into `/rita`.
- Unsaved detection uses the existing `canUndo` state already tracked in `PaintApp`.
- Navigation uses the existing `useNavigate` instance already in the file.
- The engine, brushes, layers and AR lock code are untouched.
