# Final sketch preview and AR try-on

## Goal
Let both the customer and studio clearly open the project’s approved final sketch and, when it is an image, launch it directly in the existing AR camera.

## Changes
- Add a prominent **Final design** section in the Sketches tab whenever the project has an approved final version.
- Show the approved image at full preview size, or keep the existing interactive 3D viewer for approved GLB/GLTF files.
- Keep the approved version selected by default while still allowing the user to browse older versions below it.
- Add a **Try this sketch in AR** button for approved image versions.
- On tap, securely load the signed image, convert it to the existing camera-safe image handoff format, and open `/ar` with that sketch already active in camera mode.
- Show a short loading state and a clear retry message if the private image cannot be prepared.
- For approved 3D versions, show the final proposal in the 3D viewer but do not offer AR, as requested.
- Keep approval, version history, comments, comparison, capture, HUD, and all AR lock/tracking logic unchanged.

## Verification
- Test customer and studio project views on mobile and desktop.
- Verify the approved image opens directly in AR and remains available after navigation despite expiring private preview links.
- Verify 3D final versions display correctly without an AR button.
- Run type checks, existing tests, build/error checks, and a focused mobile browser check.
