# Hide chat, SMS in the guide, private designs for one customer

## 1. Hide "Client chat" until Instagram works
- Remove the "Kundchatt / Client chat" button from the studio menu (desktop side menu, mobile menu and the quick "Chatt" button on the dashboard).
- The chat page stays in place (nothing deleted), so it can be switched back on with one line once Meta approves the Instagram connection.
- The Instagram card under Profile stays, so studios can still get ready.

## 2. Guide: new section "SMS notifications"
New bilingual (SV/EN) step in the studio guide, next to "Bookings & requests":
- What: get a text from "InkVision" for every new request, with a direct link.
- How: Profile → "Aviseringar för förfrågningar" → choose Email, SMS or both → enter mobile number (+46…) → Save → "Skicka test-SMS". If a text fails, the email is sent anyway.

## 3. Sending a design to only one customer (already possible)
Each customer request has its own private workspace. There you upload a sketch; only you and that customer see it. They can comment on spots, try it in AR, and approve it. It never goes to the public shop — only designs uploaded via "Share a design" end up there.

To make this easy to find:
- Rename/clarify the guide section "Sketches" → "Send a private design to a customer": open Requests → pick the customer → upload sketch → the customer gets it privately.
- Add a line under "Your designs (flash)" saying these are public, and pointing to the private route above.

## Technical notes
- `StudioWorkspace.tsx`: drop the `/artists/inbox` linkItem and quick button (keep the `ui` strings and route).
- `StudioGuide.tsx`: add SMS section, update "skisser" and flash copy, renumber `n`.
- No database or AR changes; typecheck, tests and build stay green.
