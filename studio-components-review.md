# Studio component review

## Scope
Component sample: `/design-preview/studio-components`. Shared StudioPrimitives buttons/cards/subsections/status/empty state and scoped studio-workbench field/tab/focus roles apply to Private sketches, Client concepts, Request, Profile & look, Agent, Availability and Calendar sync. Navigation and business handlers are unchanged. Public custom preview has an explicit exclusion; media geometry, drawing and AR are untouched. Compact shell navigation remains its existing presentation.

## Verified
- Authenticated studio session, read-only navigation: 1440×900, 390×844, 320×844; both saved themes.
- Component sample: field entry, save feedback, tab changes, both themes and visible keyboard focus.
- Help text against background/card/secondary/selected: dark 9.58/8.92/8.05/7.15:1; bright 5.66/6.23/5.32/5.06:1. All exceed 4.5:1.
- Normal-width pages have no horizontal overflow. Enlarged text at 320 px retains controls; Agent has a 1 px document-width rounding excess, with no control outside the viewport.
- Before/after captures: `/tmp/browser/studio-components/before-*`, `final-*`, `large-*`, `sample-*`.
- Preview build reports build OK.

## Limits
No live customer records were created or changed, no external messages or payments sent, no calendar connection changed, no publication performed. Populated customer-request operations and their payment/sketch flows were not exercised with real data. Existing language hydration mismatch on customer navigation still appears in browser telemetry; this task did not change the customer language system. Test screenshots cover existing authenticated studio state, not synthetic customer cases.
