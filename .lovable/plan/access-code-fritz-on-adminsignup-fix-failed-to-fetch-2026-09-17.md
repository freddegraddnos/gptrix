# Access code FRITZ on /adminsignup + fix "Failed to fetch"

## 1. Access code

The page opens with a single small box: "Access code". Nothing else is shown until the
correct code is entered.

- Code is `FRITZ`, checked on the server (not in the page), case-insensitive, spaces trimmed.
- Wrong code: "Wrong access code." and the form stays hidden.
- Right code: the full studio form appears (studio name, email, password, address, city,
  phone, website, Instagram, other social link, description, logo) exactly as it is today.
- The code is sent again together with the form when the account is created, so nobody can
  skip the gate by calling the page's backend directly.

This keeps random visitors out without adding email verification back.

## 2. "Failed to fetch"

The captured error from the preview is a stale-page error: the browser tab was loaded
before the last rebuild, so its background request pointed at a file that no longer
exists. It is not a database or account error.

Steps:
- Add a real error path: if the create call fails for a network reason, show
  "Connection lost — reload the page and try again." instead of the raw text.
- Re-test the whole signup end to end in the live preview (code, full form, logo, landing
  on the studio dashboard) and report what happens. If it still fails on a fresh page load,
  the real cause is in the create call and gets fixed in the same pass.

## Technical details

- `src/lib/adminSignup.functions.ts`: add `verifyAdminSignupCode` server fn (input `{ code }`,
  compares `code.trim().toUpperCase()` to `"FRITZ"`, returns `{ ok }`); make `code` required
  in the existing `createApprovedStudio` schema and throw `Error("Wrong access code.")`
  before `auth.admin.createUser` when it does not match. Code constant lives server-side only.
- `src/routes/adminsignup.tsx`: `unlocked` state, gate view with code input + "Continue";
  keep the code in state and pass it in the `create({ data })` payload; wrap submit errors so
  `TypeError: Failed to fetch` maps to the reload message.
- Verify with `bun test`, `bunx tsgo --noEmit`, build, plus a Playwright pass over
  `/adminsignup`. AR lock untouched.
