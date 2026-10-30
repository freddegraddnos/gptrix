# Fortnox for studios + full tattoo payment

## What studios get
1. **Connect Fortnox** (studio panel, new "Accounting" card): the studio clicks "Connect Fortnox", signs in to Fortnox and approves. They can disconnect at any time.
2. **Charge for the whole tattoo**: beside the existing deposit, the studio can request a final payment for a project (total price minus the paid deposit). The customer pays by card in the app, the same way they pay the deposit.
3. **"Send to Fortnox" button** on every paid deposit, final payment and motif sale. It creates a customer (if missing) and a paid invoice in the studio's Fortnox. The item is then marked "Sent to Fortnox" with the invoice number. If something goes wrong, a plain error shows and the studio can try again.
4. **Settings**: the studio chooses the sales account (default 3001), VAT (default 25 %) and the payment account (default 1580) used for card payments.
5. **Commission**: InkVision takes 5 % of the tattoo payments (deposit and final payment, so 5 % of the total tattoo cost) and 10 % of motif sales. The fee is recorded as a cost in the studio's books, so they match what the studio is actually paid out.

## Before we start
- The client secret you pasted in the chat is exposed. Create a new one in the Fortnox developer portal. I'll open a secure form to save both values. The client ID is not secret.
- In the Fortnox developer portal, add this redirect address:
  `https://inkvision.app/api/public/fortnox/callback`
- Turn on these permissions (scopes) for the app: customer, invoice, payment, bookkeeping, companyinformation, settings.

## Technical details
- Secrets: `FORTNOX_CLIENT_ID` and `FORTNOX_CLIENT_SECRET`, requested through add_secret after approval.
- OAuth: authorize URL `apps.fortnox.se/oauth-v1/auth` with signed `state` = studio id. The callback server route `src/routes/api/public/fortnox/callback.ts` exchanges the code for tokens.
- New table `studio_fortnox_links`: studio_id, access_token, refresh_token, expires_at, company name, account settings. Like `studio_calendar_links`, it has no client grants and only the server can reach it. A security-definer `studio_fortnox_status(_studio)` function exposes only connected/company info to staff.
- `src/lib/fortnox.server.ts`: token refresh (access tokens last 1 h, refresh tokens rotate) and API helpers for Customers, Invoices, InvoicePayments and Vouchers.
- `src/lib/fortnox.functions.ts`: `getFortnoxStatus`, `startFortnoxConnect`, `disconnectFortnox`, `updateFortnoxSettings`, `exportToFortnox({ kind: deposit|final|motif, id })`. Each checks `is_studio_staff`.
- New columns `fortnox_invoice_number` and `fortnox_exported_at` on `project_deposits` and `motif_purchases`. These prevent sending the same item twice.
- Final payment: add a `kind` column ('deposit' | 'final') to `project_deposits` and reuse the checkout and Stripe webhook. The UI is added to the project page and the customer's project view.
- UI: `FortnoxCard` in the artist dashboard, plus "Send to Fortnox" buttons in the deposits list and in MotifSales.
- The AR lock is not touched. Verify with tsgo, bun test and build.
