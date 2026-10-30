# Studio-onboarding material: detailed guide as web page + PDF (SV & EN)

## Goal
A thorough "studio handbook" Fredrik can send to tattoo studios: what InkVision is, why join, every feature, and step-by-step how-tos (upload motifs, set prices, gallery, change logo, contact info, bookings, calendar, deposits, messages). Two formats, two languages — more detail rather than less.

## 1. Web page: `/for-studios` (new route)
- New public route `src/routes/for-studios.tsx` with full studio guide.
- Language toggle Swedish / English (state-based, Swedish default since studios are onboarded personally; both languages on the same page via toggle, no router split).
- Sections:
  1. **Why InkVision** — customers try motifs on their own body with AR before booking; studios get motivated customers who already know what they want; free exposure in Studios/marketplace.
  2. **Feature overview** — AR try-on, body-scanned wrap, library, marketplace/gallery, studio profile on the map ("Partner" badge), booking requests with calendar + session links, deposits, customer messaging, Instagram DMs, client management, insights.
  3. **The customer journey** — from try-on → sending design → booking request → deposit → appointment.
  4. **Step-by-step: get started** — sign up via link Fredrik sends (access code FRITZ, no email verification), first login forces new password, forgot-password available on artist sign-in.
  5. **Step-by-step: studio profile** — studio name, street address, city, phone, website, Instagram/social links, bio, logo upload & replace.
  6. **Step-by-step: motifs & gallery** — upload motifs, categories (incl. Japanese, Realistic), pricing, studio gallery vs. marketplace, editing/removing images.
  7. **Step-by-step: bookings** — sessions & minutes per session, calendar link to customer, blocking busy times, Google Calendar sync, deposits.
  8. **FAQ / contact** — how to reach Fredrik/InkVision.
- Real screenshots of the app (dashboard, upload, bookings) captured via Playwright and embedded.
- Own `head()` with title "For Studios — InkVision" / meta description; CTA button linking to `/adminsignup`.
- Link to the page added in footer/about where appropriate.

## 2. PDF guide (SV + EN), in Files
- Two PDFs: `InkVision-Studioguide-SV.pdf` and `InkVision-Studio-Guide-EN.pdf`, same content structure as the web page.
- Built with reportlab (DejaVu fonts for Swedish characters), InkVision branding, screenshots, and a QR code to `https://inkvision.app/adminsignup` on the first/last page.
- Visual QA: render to images with pdftoppm, inspect every page, fix overflow/spacing, re-verify.
- Saved to Files so Fredrik can download and email/print them.

## 3. Verification
- `bunx tsgo --noEmit`, `bun test` (16/16), build OK.
- Playwright check of `/for-studios` in both languages (toggle works, screenshots render).
- No changes to AR lock or existing flows — only additive.

## Technical details
- Route: `src/routes/for-studios.tsx`; screenshots under `src/assets/for-studios/` (also reused in PDF).
- PDF generation script in `/tmp`, output to `/mnt/documents/`.
- QR code generated with `qrcode` Python package (or existing onepager approach from earlier).
