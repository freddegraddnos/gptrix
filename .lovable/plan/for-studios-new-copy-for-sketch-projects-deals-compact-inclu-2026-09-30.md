# /for-studios: new copy for sketch projects & deals + compact "Included" section

## What changes

All changes are in `src/routes/for-studios.tsx` (both Swedish and English text blocks). No backend, no other routes.

### 1. Updated copy in the Features overview (chapter 03)

- **Custom sketch projects** — new description:
  - EN: "The client describes the idea, you create versions and send them back in-app. Our sketch tool is compatible with file formats from ProCreate and others."
  - SV: "Kunden beskriver idén, du skapar versioner och skickar tillbaka i appen. Vårt skissverktyg är kompatibelt med filformat från ProCreate m.fl."
- **Deals & pricing** — new description:
  - EN: "Create deals, price designs and manage deposits. Run a flash deal on short notice if you get cancellations."
  - SV: "Skapa deals, prissätt motiv och hantera depositioner. Kör en flash-deal på kort varsel när du får avbokningar."

### 2. "Included in your plan" becomes click-to-read (like the FAQ)

Replace the three tall text cards with the same `details/summary` pattern the FAQ section already uses (chevron, rotate on open, no list marker):

- Row layout: small icon + tag + bold title on the summary line; full description revealed on click.
- Grid `md:grid-cols-2` with `gap-px bg-card border` so the section takes one or two compact rows instead of three tall cards.
- Same hover colors and violet glow classes already used on the page; works in Dark and Bright themes and both languages.
- Lead sentence stays; the long descriptions (SMS, Fortnox, Posture Pro) move under their collapsed rows unchanged.

## Verification

- tsgo typecheck + build green.
- Playwright check at 393 px and 1280 px, Dark and Bright, EN and SV: collapsed section is compact, clicking a row expands the text, chevron rotates.
