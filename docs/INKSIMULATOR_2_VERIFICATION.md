# InkSimulator 2.0 verification

## Baseline

Source: Git commit `0055181f1694b09bcfc50c2445c6dcee46843aed`; a read-only source archive at `/workspace/ink-baseline` was checked separately from the upgrade branch. The uploaded ZIP could not be downloaded, so equivalence between ZIP and GitHub source is unverified.

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` passed, exit 0.
- Vitest 3.2.4: 107 tests passed in 22 files.
- Bun 1.3.3 (Bun and node:test files): 43 tests passed in 7 files.
- Full ESLint: failed with 13,623 errors and 52 warnings, including 13,567 Prettier errors. These are existing repository findings, not a passing lint baseline.
- The original build compiled client/server bundles, but outside the Lovable runtime its prerender crawler followed dynamic studio links and failed without backend data. The upgrade sets `crawlLinks: false` while retaining the explicitly configured public prerender pages. Production backend/SEO data is not validated by a local build.

## Checkpoint before final studio/availability additions

- TypeScript passed with exit 0.
- Vitest: 140 passed in 27 files. Bun/node:test: 49 passed in 9 files. Total 189 passed, no failed or skipped tests.
- The tests include existing isolated prototype tests. They are not proof of deployed backend permissions, delivery, payments, or camera tracking.
- Two introduced non-format ESLint errors in redirect validation were corrected by equivalent character-code checks; all 15 redirect tests passed again and that file has clean ESLint output. Newly created files are formatted separately without reformatting the legacy application.
- Full lint remains failing. The initial current scan had 14,017 errors / 52 warnings before these corrections; final counts will be recorded after all owners finish.

## AR scope

All 11 files listed in `INKSIMULATOR_2_AR_AUDIT.md` still match the original SHA-256 values. The original AR routes, camera engines, global CSS, router/provider setup, generated route tree and dependency declarations/lockfiles have no diff at this checkpoint. The 36 existing AR geometry/tracking unit tests pass as part of the suites above.

Shared persistence and wrappers *have* changed: photo try-on recovery, pending-save acknowledgement, login return, project save failure handling and motif/studio request context. These require the specified full mobile regression journey even though the rendering engines themselves are unchanged. Physical camera permission/denial, tracking, locking, calibration, export and optional engine fallback remain manual checks.

## Isolated execution and evidence

No tests intentionally call production Supabase, send customer messages or make payments. The local server uses a loopback backend address; browser checks block external requests and stub backend responses where required. A missing/blocked external logo asset in an isolated screenshot does not indicate the source logo was replaced.

Durable raw output is in `/workspace/verification`: baseline/final `tsc.log`, `vitest.log`, `bun.log`, ESLint JSON, `lint-summary.json`, `ar-sha.log`, build/browser/migration logs. Vitest and Bun are installed outside the application at `/workspace/dev-tools`; application dependencies use `/workspace/ink-deps/node_modules` with exact Bun lock versions and checksums, changing only inaccessible package-cache URLs in that external copy. No app dependency versions were updated.

The disposable PostgreSQL fixtures test migration policies against a controlled minimal schema. They do not replace integration tests against the actual deployed Supabase schema and authentication. Apply reviewed migrations to a staging environment, then test owner/admin/artist/customer/outsider access before production deployment.

## Senaste kontroll efter agentavbrott

Senaste koden kontrollerades lokalt: 159 Vitest-tester i 30 filer samt tidigare oförändrade 49 Bun/node-tester (208 totalt) passerar. TypeScript passerar; riktad ESLint utan befintlig Prettier-regel för sista delarna passerar. Nya fler-mottagartester verifierar samtidig inlämning, delvis mottagning/återförsök, stabila snapshots och mottagargräns. Senaste loggar: `latest-vitest.log`, `latest-tsc.log`, `latest-changed-lint.log`.

Fullbygget som passerade föregick sista tilläggen; det slutliga bygget och sammanhängande browserresor är fortfarande inte verifierade. Automatisk godkännandegranskning kunde inte köras på grund av tjänstens användningsgräns. Se `INKSIMULATOR_2_DELIVERY.md` för komplett leveransstatus och kvarstående externa beroenden. Tidigare uttryck om att fler-mottagarflödet saknar idempotens ersätts av testerna ovan.
