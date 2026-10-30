Keep homepage layout, in-flow navigation and source-derived logo in `HomePosterPage`, CSS in `.home-poster`; `TryOnStartMenu` and studio/AR stay isolated.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the black/white/violet theme and paper artwork surfaces site-wide. Why: preserve the brand without changing AR.
- Freeze motif bitmap, wrap, cylinder and joint geometry throughout Live AR lock; tracked pose alone moves it. Why: no shape drift.
- Keep studio UI in StudioWorkspace without altering dashboard tab behavior. Why: presentation and data stay separate.
- Track guide-origin navigation apart from dashboard tabs; clear on ordinary tab changes. Why: reliable guide returns.
- Composite still-photo previews/exports in 2D; keep Live AR in WebGL. Why: consistent motifs without tracking changes.
- Use InkSimulator branding and https://www.inksimulator.com URLs (live primary); retain old storage keys, IDs, sender domains. Why: no redirects for crawlers, mail intact.
- Signup requires real confirmed email, optional phone/adulthood; block booking by minors in database. Why: deliver notices and enforce age.
- Discover only manually added artist_profiles with status and approval_status both approved. Why: exclude outside/demo artists.
- Default public studio pages to English except Swedish browsers; remember language choice. Why: serve international visitors.
- Keep studio presentation, interest and guide on separate EN/SV URLs, walkthrough under guide/setup. Why: index each language/intent without replacing studio help.
- Keep studio time-value math pure/tested, drafts in sessionStorage and the shared language hook route-initialized. Why: preserve exact calculations and scenarios across guide/language returns without backend changes.
- Keep bilingual overview/proofs in ForStudiosPage using real anonymized captures. Trial presentation terms stay separate from billing. Why: truthful copy without payment changes.
- Snapshot motif commission per sale (old 10%, new 5%) for balances/Fortnox. Why: preserve historic obligations.
- Scope saved Dark/Bright mode to studio-owned workspace and its subpages, including studio-origin notifications. Why: customer pages and AR stay unchanged.
- Studio notices go to notify_email, else contact email, else auth email; never admin Gmail. Why: protect client communications.
- Use the saved signed booking photo URL and a shared BookingPhoto email component for customer and studio notices. Why: identical booking images without public storage or attachments.
- Public route heads use seo() from src/lib/seo.ts; key pages are prerendered in vite.config.ts (router trailingSlash preserve). Why: crawlers get full HTML.
- Swedish style and animal search pages reuse SvMotifLanding and the built-in catalogue selections; creation and numeral guides reuse SvLanding. Why: unique search intent and truthful previews without duplicating tool or AR logic.
- Booking agent lives in src/lib/agent.server.ts, per-studio settings in studio_agent_settings, public chat at /agent/$handle. Why: one agent per studio using its own slots/calendar.
- /ar uses DeepARViewer with WebGL multiply, cylindrical warp and One Euro filtering; AR_ENGINE in src/lib/deepar.ts selects unmodified classic ARCamera fallback (copy in archive/). Why: retain proven engine.
- Image-reference UI changes stay presentational; keep live data/flows. Why: no mock content.
- Share the installed font catalogue and text-motif renderer across text creation surfaces. Why: installed faces and lettering layouts must preview and export consistently.
- Isolate review concepts; retired builder preview links to Profile & look using existing sources. Why: one public page, no duplicate records.
- Apply the studio visual profile via public studio roots, StudioLoginPortal, StudioShell and studio-owned AppShell pages. Why: consistent look, unchanged flows.
- Use `/<handle>/book` as the canonical studio booking URL and keep `/boka/<handle>` as a permanent compatibility redirect. Why: studios need a short shareable address without breaking existing links.
- Validate and normalise studio external websites with src/lib/externalUrl.ts on save and render; hide invalid values instead of rewriting them. Why: never render relative or guessed links.
- Interface text uses tx() from src/lib/uiLang.ts with Swedish strings in src/lib/i18n/sv.ts keyed by English source; user/studio-entered data is never passed through tx(). Why: one remembered language across customer and studio journeys without translating real content.
- Scope shared studio working controls with `.studio-workbench` and reuse StudioPrimitives; exclude `.studio-custom-preview` and media/canvas regions from descendant rules. Why: platform consistency must not change studio-owned published themes or rendering.
- /design-preview/sketch-workflow: synthetic state only, no cloud/engine imports. Why: no real data.
- Read subdirectory AGENTS.md before editing there.
- Use one official-logo asset for shared lockups and derived public brand/icons; preserve studio logos. Why: consistent branding.
- Studio needs-action/unread/case status only via src/lib/caseAction.ts. Why: no invented deadlines.
- Onboarding status only via src/lib/studioOnboarding.ts; test timestamps set only after a successful send. Why: no unverified readiness.
