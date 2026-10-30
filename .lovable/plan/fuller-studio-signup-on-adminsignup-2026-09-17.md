# Fuller studio signup on /adminsignup

Today the page only asks for studio name, city, email and password. It gets the rest of the studio details: address, website, social media, phone, logo — all optional.

## New form (in order)

Required:
- Studio name
- Email
- Password

Optional:
- Street address
- City
- Phone number
- Website
- Instagram (username or link)
- Other social link (Facebook/TikTok) — stored alongside the website link
- Short description of the studio
- Logo (pick an image, shown as a small preview before you create the account)

Empty optional fields are simply left blank on the studio — nothing is required to create the account, and everything can still be changed later from the studio dashboard.

## Behaviour

- The page keeps working the same way: no code, no email verification, account is live and approved right away, then you are taken to the studio dashboard.
- The logo is uploaded straight after the account is created, so it appears on the studio profile immediately.
- If the logo upload fails, the account is still created and a small notice says the logo can be added from the dashboard.
- Fields are grouped under two small headings, "Studio" and "Contact & links", so the page reads as a real signup form rather than four loose boxes.

## Technical details

- Migration: add a nullable `phone text` column to `artist_profiles` (the table already has `address`, `website`, `instagram`, `bio`, `logo_url`; there is no phone column). No RLS/grant change needed — existing table policies cover it. Regenerate types after the migration.
- Migration also adds nullable `social_url text` for the extra social link.
- `src/lib/adminSignup.functions.ts`: extend the zod schema with optional `address`, `phone`, `website`, `instagram`, `socialUrl`, `bio`; trim and map to `null` when empty in the `artist_profiles` upsert. Return the created `user_id` so the client can attach the logo.
- `src/routes/adminsignup.tsx`: add the new controlled inputs plus a file input for the logo with an object-URL preview. After `createApprovedStudio` and `signInWithPassword` succeed, call the existing `uploadStudioImage(userId, file, "logo")` helper used by `artists.dashboard.tsx`, then update `artist_profiles.logo_url`, then navigate to `/artists/dashboard`. Logo upload errors are caught and surfaced as a non-blocking message.
- Verify with `bun test`, `bunx tsgo --noEmit` and the build. AR lock untouched.
