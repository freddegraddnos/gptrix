# Fix the start page buttons so each one opens the right thing

## What is wrong today

The three camera buttons on the start page ("Try a design", "Upload picture", "Text") all open the camera with a note about which one was tapped. The camera only checks whether the note says "upload" — everything else falls through to the text writer. So "Try a design" opens the text tool instead of the design gallery, and the same happens whenever that note is still hanging around in the address.

A second problem follows from the first: the note stays in the address after it has been used. Coming back to the camera, reloading, or tapping the camera button in the bottom bar can trigger the same tool a second time, which is why tapping the camera can land on the text writer.

## What will change

1. Each of the three choices opens exactly what it says:
   - Try a design: camera opens with the design picker, no tool on top.
   - Upload picture: camera opens and the photo picker opens.
   - Text: camera opens and the text writer opens.
2. Anything unexpected in that note is ignored and simply opens the plain camera.
3. The note is cleared from the address once it has been used, so returning to the camera or tapping the camera button in the bottom bar always gives the plain camera.
4. Walk through the remaining start page entries and confirm each points where its label says: AI creator, Sketch your own, My account / My bookings, My designs, How it works, Browse designs. Anything mismatched is corrected.

## Technical notes

- `src/components/ARCamera.tsx`, the start-intent effect (~lines 221-236): the `else` branch currently calls `setTextOpen(true)` for any non-upload value. Split into explicit `design` / `upload` / `text` handling; `design` only sets `started`. Also skip the "custom motif help" hint for `design`.
- After acting on the intent, replace the URL search (`navigate({ to: "/ar", search: (s) => ({ ...s, start: undefined }), replace: true })`) so the intent cannot fire again.
- `src/components/TryOnStartMenu.tsx` in-camera callbacks already behave correctly; keep them as the reference behaviour.
- No change to the AR lock or tracking code.

## Verification

Run through each start page button in a phone-size preview and confirm the destination matches the label, then tap the camera button in the bottom bar and confirm it opens the plain camera. Typecheck, tests and build must stay green.
