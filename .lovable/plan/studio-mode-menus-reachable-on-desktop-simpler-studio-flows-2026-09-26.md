# Studio mode: menus reachable on desktop + simpler studio flows

## Goal
Every studio menu and button is visible and clickable on desktop, laptop and tablet. The studio area is easy to learn and quick to work in. AR is not touched.

## Step 1: Find what is broken (screenshots first)
- Sign in as a studio and screenshot the studio panel and all its pages at 1440, 1280, 1024, 754 (your current window) and 393 px wide.
- Write down every button or menu item that is missing, cut off or covered. Likely causes to check:
  - The fixed "Dashboard" back button in the top right sits on top of the SV/EN switch, Insights and Customer view.
  - Between 768 and 1024 px, the side menu is hidden and only the sideways-scrolling mobile row shows.
  - Header links are hidden at some widths.
- The fix starts from these findings, not from guesses.

## Step 2: Fable 5.1 reviews the studio area
- Send Fable (via your API key) the screenshots, the list of problems, the current studio layout code, all menu items and the studio flows below.
- Fable returns one navigation design that works on every screen size, plus a list of the changes needed.

## Step 3: Simplify the main studio flows
Fable goes through each flow and cuts extra clicks:
1. Log in, land on the panel, see today's bookings and new requests right away.
2. New request, open it, reply or book.
3. Calendar and availability.
4. Chat inbox and Instagram.
5. Payments and Fortnox.
6. Profile, gallery and motifs.
7. Studio guide, language switch, sign out, Posture Pro.

Clear rules:
- One always-visible menu on desktop (side menu from 1024 px). Below that, a menu button that opens the full list, instead of a hidden sideways scroll.
- Back to Dashboard sits in the header on every studio page and never covers anything.
- Menu labels follow the SV/EN choice.

## Step 4: Check
- Screenshot again at every width and confirm every menu item can be reached and clicked.
- All 19 AR tests, typecheck and build pass.

## Technical section
- Files: StudioWorkspace.tsx (layout, nav breakpoints, header), StudioBackButton.tsx (move from fixed overlay into header slot), studio routes (artists.inbox, requests, requests.$id, clients.$id, insights, messages), __root.tsx where the back button is currently mounted.
- Presentation only: tab bodies, data, bookings, payments, Fortnox and AR logic are unchanged.
- Fable called via api.anthropic.com with model claude-fable-5-1; output integrated by hand.
