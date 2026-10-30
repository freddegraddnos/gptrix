# Make ChatGPT and other AI crawlers able to read the site

## What the live test showed (just now)
I fetched the live site with OpenAI's three crawler names (GPTBot, ChatGPT-User, OAI-SearchBot):
- `www.inksimulator.com` and `www.inksimulator.com/for-studios` answer **200 with full text** (11 H2 headings, 1 H1). Nothing in robots.txt blocks them.
- But every address **without www** (`inksimulator.com`, `inksimulate.com`, the lovable.app address) answers with a **temporary redirect (302)** to www.
- All our canonical tags, the sitemap, robots.txt's sitemap line, llms.txt, the structured data and the studio list for AI agents point to the **non-www** address. So every link a crawler is told to trust bounces through a temporary redirect first. Google tolerates this; AI fetchers often give up or treat the page as "moved".
- The page's HTML contains 3 invisible **null characters** (from the framework's hydration data near the end of the page). Many text tools see a file with null characters as a *binary file* instead of a web page — my own test tools did exactly that. This is a likely reason an AI fetcher reports "can't see anything".

## Fixes (no visible change for people)

### 1. One address everywhere: https://www.inksimulator.com
- Switch every public site link to the www address — the one that actually answers 200:
  - canonical tags and og:url on all pages
  - sitemap.xml, robots.txt sitemap line, llms.txt, /for-studios.md
  - structured data (Organization, WebSite, Service/FAQ)
  - studio list for AI agents (profile and booking links)
  - links in e-mails and share links (saves a redirect for recipients too)
- Old non-www links keep working — they still redirect to www.

### 2. Remove the null characters from the HTML
- Clean every HTML page on its way out of the server: each raw null character is replaced with its text escape (`\u0000`). It sits inside script text, so the browser reads exactly the same value — the app behaves identically, but the page is now pure text for crawlers.

### 3. Verify
- Locally: no null characters left in the HTML of `/` and `/for-studios`, canonical = www, sitemap only has www addresses, the app still loads and works (Playwright on the homepage and /for-studios).
- After you publish: re-run the crawler test against the live site with OpenAI's crawler names.

## What I cannot control
- The hosting runs behind a bot shield. From my test machine OpenAI's crawler names get through, but I cannot test from OpenAI's own servers. If ChatGPT still fails a few days after publishing, the remaining blocker is on the hosting side and needs Lovable support.
- ChatGPT caches pages; it can take days before it fetches again.

## Technical details
- Global replace `https://inksimulator.com` → `https://www.inksimulator.com` in `src/` and `public/` (167 occurrences in ~60 files). Email sender domains (`notify.inkvision.app`) and storage keys are untouched.
- `src/server.ts`: for responses with `content-type: text/html`, pipe the body through a `TransformStream` (TextDecoder/TextEncoder, streaming) that replaces `\u0000` with the literal 6-char string `\u0000`. Non-HTML responses pass through untouched.
- Update the AGENTS.md rule from "canonical + sitemap without www" to "canonical + sitemap use https://www.inksimulator.com (the live primary)".
- If you later set the non-www address as primary in domain settings, the canonical base must be switched back — one constant/replace.
