# One domain, social proof, and "no sign-up needed"

## 1. One domain: inksimulator.com
The brand is InkSimulator, so inksimulator.com becomes the single address. Right now the site settings send everyone to inksimulate.com while the pages point to inksimulator.com. That conflict is the problem.
- The code already uses https://inksimulator.com for page addresses, share previews, the sitemap and robots.txt. I will check every page and fix any leftover inksimulate.com or inkvision.app links. Only ws.inkvision.app and addresses already registered with Instagram or Google stay as they are.
- **You do one step:** Project Settings → Domains → inksimulator.com → ⋯ → **Set as primary**. After that, inksimulate.com, both www addresses and inkvision.app send visitors to inksimulator.com with a permanent redirect. Then publish.
- If you want inksimulate.com instead, tell me and I'll change the code to match.

## 2. Customer quotes at the bottom of the homepage
- Add a short "What people say" section below the buttons, styled like the rest of the page: dark cards, violet quote mark, Anton name line, DM Mono text, and the same lifted 3D edge.
- Use two existing quotes:
  - Sofia, 29: "Last time I wished I hadn't made the tattoo bigger. That will never happen again!..."
  - Jonas, 34: "Saved loads of time at the studio. Size and placement were spot on right away."
- These quotes already appear on the About page. Please confirm they come from real users.

## 3. Try first, sign up later
- Live AR and photo try-on already work without an account, so under the main button it will say **"No sign-up needed"**.
- Ask for an account only when someone:
  - saves a design,
  - shares,
  - sends a booking request,
  - uses the AI generator.

  The design they picked stays in place through sign-in, like it already does for "Send to studio".
- The AI generator currently opens without login, so it gets the same sign-in prompt before generating.

## Technical details
- `src/components/TryOnStartMenu.tsx`: small "No sign-up needed" line under the Try-it-free link, plus a `Testimonials` block rendered when `showLogo` is set. The quotes move to a shared `src/lib/testimonials.ts` that `about.tsx` also uses.
- `rg` sweep for `inksimulate\.com|inkvision\.app` in src/public, excluding sender domain, storage keys and the external callbacks listed in AGENTS.md.
- Generator: gate the generate action with the existing pending-redirect sign-in flow (`authRedirect.ts`). Share and save paths already call the pending try-on saver, so I'll check them and add the gate where it's missing.
- Verify with Playwright at 393 and 1280 px and check that the build passes. AR engine untouched.
