# Posture Pro for InkVision studios

## Goal
- A "Posture Pro" link in the studio panel.
- Every InkVision studio can sign in to Posture Pro with the same email and password they use in InkVision.
- Posture Pro is included for InkVision studios (no extra payment or waitlist).

## Important
Posture Pro has its own separate user database. A shared login therefore needs a small "bridge": when a studio signs in to Posture Pro, Posture Pro asks InkVision "is this a real studio with this password?". If yes, the account is created or updated in Posture Pro and the studio is signed in. Passwords are never copied or stored in plain text; if a studio changes password in InkVision, the new one simply works next time.

Part of the work must be done inside the Posture Pro project. I can only change InkVision from here, so I will build InkVision's side and hand you a ready-made message to paste into Posture Pro.

## Step 1 — InkVision (this project)
1. Studio panel: new "Posture Pro" card/button ("Included for InkVision studios") that opens Posture Pro in a new tab, with a short note: "Sign in with your InkVision email and password."
2. Secure check endpoint that Posture Pro calls: takes email + password, confirms the password is correct and that the account is an approved studio, and answers yes/no with studio name. Protected with a shared secret key so only Posture Pro can use it, plus rate limiting against password guessing.
3. Create the shared secret key (stored securely, never shown in chat).

## Step 2 — Posture Pro (you paste my instructions there)
1. Store the same shared secret.
2. On sign-in: if normal login fails, ask InkVision. If InkVision confirms a studio, create/update the user with that password, mark them "InkVision studio – included", and sign them in.
3. Users marked as InkVision studios skip the waitlist/payment.
4. Sign-in page text: "InkVision studio? Use your InkVision login."

## Technical details
- InkVision: server route `src/routes/api/public/partner/verify-studio.ts` (POST, header `x-partner-secret` compared with `timingSafeEqual`, zod input). Verifies via a non-persisting publishable client `signInWithPassword`, then checks `artist_profiles` approved row for the user id; signs out that temp session. Returns `{ ok, studioName }` only; no tokens. Simple per-email throttle table.
- Secret `POSTURE_PRO_BRIDGE_SECRET` via generate_secret; value given to the user through the secrets UI for Posture Pro, not chat.
- Link card added to the studio dashboard (`artists.dashboard.tsx`), Posture Pro published URL.
- Posture Pro side: server fn with admin client `auth.admin.createUser/updateUserById` + `inkvision_studio` flag, then client `signInWithPassword`.
- Verify: tsgo, bun test, build, curl the endpoint (wrong secret 401, wrong password false).
