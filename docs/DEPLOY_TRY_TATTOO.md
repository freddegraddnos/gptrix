# Deployment to try.tattoo through GitHub and Lovable

Target repository: `freddegraddnos/gptrix`. The source repository `freddegraddnos/ar-ink-canvas` remains unchanged remotely. A push to GitHub proves code synchronization, not publication, DNS, database migration or live behavior.

## Application origin

Set the non-secret build variable `VITE_SITE_URL=https://try.tattoo` for the target Lovable project. A target-only `.env.production` may supply it. Set runtime `SITE_URL=https://try.tattoo` when supported; otherwise the server uses the compiled `VITE_SITE_URL`. Keep both values equal so prerendered/client and server-generated URLs agree.

Both accept only an HTTPS origin without credentials, path, query or fragment. An invalid explicit value fails instead of silently sending private approval links to a different host. With neither configured, the original `https://www.inksimulator.com` default remains.

This configuration covers shared SEO canonical/OpenGraph/Twitter/breadcrumb URLs, root structured data, primary studio/profile/gallery entry pages, sitemap/robots, studio booking links and operational request/session/booking/approval notification links. Brand names, storage IDs, email senders, business data and original links are preserved. Some standalone legacy page metadata and legacy email-preview defaults still explicitly reference the old primary; this change does not claim a complete SEO migration of every historical page.

`robots.txt` now comes from a server route with the same existing crawler directives, using the configured sitemap host. The old static copy is removed to avoid shadowing this response. The generated router adds this route; existing AR routes are not changed.

## Required hosting capabilities and settings

- Connect the target GitHub repository and intended branch to the intended Lovable project. The checkout's `.lovable/project.json` describes the template; it does not provision or prove a new hosting project.
- Use TanStack Start SSR/API hosting. The Lovable Vite integration uses Nitro with Cloudflare as its default production target. GitHub Pages static-only hosting cannot serve this application's server functions, authenticated APIs and workflows.
- Build with `npm run build` using the application's locked dependencies. `npm ci` fails on the original source because its npm lockfile is stale; the newer Bun lockfile is the verified source. See `INKSIMULATOR_2_DELIVERY.md` for the exact-version local installation evidence. Never disable TLS or checksum checks to repair registry access.
- Configure the existing Supabase connection in the target hosting environment: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` at build and `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` for server operations. Enter secrets in secure hosting settings, never repository files or chat.
- Review and apply additive SQL migrations **0057, 0058, 0059, 0060**, in journal order, against the intended database before enabling the new app. Validate real owner/admin/artist/customer/outsider RLS and storage access in staging first. `drizzle/schema.ts` is intentionally blank; do not use schema-push/generation as a substitute for these SQL migrations. The configured migration connection variable is `LOVABLE_DB_MIGRATION_URL`.
- Add `https://try.tattoo/auth`, `https://try.tattoo/reset-password` and `https://try.tattoo/artists/set-password` to the actual Supabase/Lovable auth return allowlist as appropriate. Test confirmed-email signup, Google login and password reset with test accounts; no real authentication message has been sent by these checks.
- Bind `try.tattoo` in the target Lovable project's domain settings, apply the exact DNS records Lovable supplies and verify TLS. Do not guess A/CNAME/TXT values from another project.
- The shared official logo now uses the existing source-derived `/brand/inksimulator-logo.png` shipped in this repository; it no longer depends on the original project's asset proxy. Browser verification decoded the original 1760×868 PNG without page errors. Other existing guide screenshot asset references still use Lovable's asset proxy.
- The preserved classic AR engine is the default. Existing domain-bound DeepAR keys do not include `try.tattoo`; optional DeepAR requires an appropriate license before it can be advertised as supported on that hostname.
- Configure only integrations already needed by the selected modules. Payments, messaging and external services remain subject to their actual credentials, callbacks and account status. Selecting a module does not activate an integration.

## Verification and rollback

Run unit/SQL checks and the final build, then the local browser scripts with external traffic blocked. After an actual deployment, verify only non-destructive public requests until isolated account/integration access is available. Physical camera tracking and exports still require iPhone/Android testing.

The source release and origin-configuration commits are separate. Reverting origin configuration restores the old default without changing data; rolling back after a real database migration needs a reviewed database plan/backup rather than dropping new customer records. No DNS binding, production publish, external migration, customer message or payment is performed by this document.

## This GitHub import

The initial gptrix snapshot comes from source release `806fa563f442df3a8d5957b7eebb18c4b2a7b507`. Original source history is retained in ar-ink-canvas; no published history was rewritten. The target-only `.env.production` sets `VITE_SITE_URL=https://try.tattoo`. Build artifacts from local verification are excluded. Hosting must build from these files with its real Supabase configuration and apply migrations0057–0060. A Git push is not evidence that Lovable has completed its build or published the custom domain.

Runtime `.env` and `.env.development` files are excluded from the target repository and its published history. `.env.example` lists required names with empty values. Configure actual values in Lovable secure environment settings before enabling authenticated workflows. The only committed production setting is the non-secret public site origin.
