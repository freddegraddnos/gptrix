# Studio mode: Fable's menu and one page layout for every studio page

Fable 5.1 (claude-fable-5-1, via Anthropic's API on your credits, HTTP 200) wrote the grouping and the page layout below. I sent your complaints word for word and did not steer the design. I only changed one thing: Fable suggested a black accent, but I kept your black/white/violet brand and Anton headings.

## 1. New menu: 6 categories, always with text labels

| Category | Pages (the first one opens when you pick the category) |
|---|---|
| Overview / Översikt | **Today**, Notifications, Statistics, Setup guide |
| Bookings / Bokningar | **Bookings**, Requests, Clients, Booking agent |
| Calendar / Kalender | **Calendar**, Availability, **Calendar sync** (new page of its own: connected Google account, change email, reconnect, disconnect) |
| Create / Skapa | **Sketches** (drawing tool), 3D models |
| Studio page / Studiosida | **Profile & look**, Gallery, Designs for sale ("Sell a design" button lives here), Services & prices, Deals, Team |
| Settings / Inställningar | **Payments & Fortnox**, Memberships, Notification settings (moved out of Memberships), Language & theme, Posture Pro |

Always in the top bar instead of the menu: "View customer page", plus a studio-name menu with Copy booking link, Language, Theme and Sign out.

## 2. The "Go to" button next to the title

- Every studio page gets a clearly labeled **"Go to ▾ / Gå till ▾"** button right beside the title, including on Overview.
- It opens a panel with all 6 categories and their pages as plain text. The page you're on is highlighted. Every page is one click away. Esc or clicking outside closes it.
- Computer (1024 px and wider): a fixed left menu with the 6 category names in text. It never shrinks to just symbols. The current category opens to show its pages.
- Tablet (about 754 px): no side menu. A row of the 6 categories in text sits under the top bar, and a second row with the category's pages sits under the title.
- Phone (about 393 px): a bottom bar with Overview, Bookings, Calendar and Menu, each with an icon and its name. "Go to" sits under the title.
- Requests stays one click away (Bookings category, the second row on tablet, and the "Go to" panel).

## 3. The same layout on every studio page

This covers the dashboard sections, plus Requests, Clients, client details, Statistics, Notifications, request details and both booking detail pages.

- **Top bar:** the back button is always top left, always text, always the same style, and always names where it goes ("← Bookings", "← Overview", "← Setup guide", "← Notifications"). On the right: "View customer page" and the studio-name menu, nothing else.
- **Where back goes:** a page goes to the first page of its category, and the first page of a category goes to Overview. Overview has no back button. A detail page goes to its list. If you came from the guide or a notification, back goes there, but only for that one page.
- **Title row:** small category name, then the Anton heading with a thin violet shadow, then "Go to ▾". On the far right, at most one main action in violet (for example "Sell a design", "Connect Google Calendar").
- The same colours, cards and spacing everywhere, following the Dark/Bright choice. No page picks its own button colour.
- **Removed:** the floating "Dashboard" button top right, the separate "Back to studio" link, the "All sections" button, the Inbox/Clients/Dashboard links in the Requests header, and every symbol-only menu.

## 4. Check everything

Screenshots in Dark and Bright at 393, 754 and 1280 px of: Overview, one page per category, Requests, Clients, Statistics, Notifications, both booking detail pages and Calendar sync. For each one I'll confirm:
- the back button is in the same place with the right destination
- "Go to" is next to the title
- the colours follow the theme
- there are no page errors or sideways scrolling

I'll also check the way back from the guide and from a notification.

## Not changing

The AR, customer pages, the public for-studios page, booking emails and SMS, and what each section does or saves. Only the navigation and layout around it change.

## Technical details

- A new `StudioShell` component, pulled out of `StudioWorkspace`, renders the top bar, title row, "Go to" panel, category sidebar/tabs and mobile bottom bar. `StudioWorkspace` and the standalone studio routes (`artists.requests`, `artists.requests.$id`, `artists.clients.*`, `artists.insights`, `artists.bookings.$id`, `artists.agent-bookings.$id`, studio-origin `notifications`) all render inside it instead of `AppShell`.
- A single `studioNav.ts` config (categories → items, each item either a dashboard tab id or a route, plus its back target) drives the sidebar, tabs, Go-to panel and back logic.
- New dashboard tabs: `sync` (moves `StudioGoogleCalendarCard` out of `hours`), `notifs` (moves `NotificationSettings` out of `members`) and `prefs` (language/theme/Posture Pro). Existing tab ids and what they render stay as they are.
- `/artists/dashboard?tab=<id>` lets standalone pages link to a section. The existing `?guide=` return keeps working. The origin is carried with `?from=guide|notifications` together with the existing sessionStorage markers.
- Remove `StudioBackGate`/`StudioBackButton` from `__root.tsx` for pages that now use the shell. Keep the theme boundary.
- Fix the existing hydration mismatch on insights, notifications and detail routes while moving them into the shell (render the same placeholder on server and client until auth has resolved).
- Update `AGENTS.md` (one shell plus nav config for all studio pages) and `roadmap.md`.
