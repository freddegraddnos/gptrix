# InkVision redesign — Fas 1, 2, 3, 5, 6

AR-motorn och allt kopplat till den (kamera, lås, spårning, wrap, geometri) rörs inte. Bara utseende, navigation och sidstruktur ändras. Fas 4 (sökaren) hoppas över.

## Fas 1 — Grund & designsystem
- Ladda Anton (rubriker, versaler) och DM Mono (brödtext, etiketter, mått) i sidhuvudet.
- Nya färger i hela appen:
  - Paper #F6F2EA — bakgrund i galleri, skapa, profil, studio
  - Ink #161616 — text, kanter, mörka kameraytor
  - Slate #E9E4DA — kort, fält, tunna linjer
  - Oxblood #7A1F1F — knappar, aktiva val, fokus
- Formspråk: 2px bläckkonturer på kort/knappar, generösa rundningar, inga glödeffekter eller gradients.
- Befintliga knappar, kort, fält, dialoger och flikar får automatiskt nya stilen via de gemensamma komponenterna.

## Fas 2 — Navigation & skal
- Bottenmenyn blir 4 punkter: **Try**, **Discover**, **Create**, **Profile**.
  - Try → startläget (foto/live)
  - Discover → galleri, motiv, studios, community
  - Create → sleeve builder, text, ritprogram, "create your own"
  - Profile → mina designer, try-ons, bokningar, konto (studios ser även "Studio")
- Gemensam sidram med rubrikrad i Anton, konsekventa marginaler och säker yta för mobil.
- Kamera-/AR-sidor behåller mörk helskärm utan meny.

## Fas 3 — Startläge
Två stora val direkt när man öppnar appen:
- **PHOTO TRY-ON** — "Test on a still photo. Upload a picture or snap one of your arm, leg or back — then dial in placement, angle and size at your own pace."
- **LIVE AR** — "See it on your skin in real time. True 1:1 scale that follows your body as you move."
- Under: sekundära genvägar (Create your own, Browse motifs, Find a studio). Båda valen går till exakt samma flöden som idag.

## Fas 5 — Skapa & galleri
- **Create** blir en samlad yta med fyra kort: Sleeve Builder, Text/Lettering, Drawing Studio, Create your own (motiv + text). Ingen funktionalitet tas bort.
- **Discover** samlar galleri/bibliotek (kategorifilter: Japanese, Realistic, Traditional, Fine Line m.fl.), studios och community under flikar.
- Varje motiv: ett tryck → "Try on photo" / "Try live" / "Customize".

## Fas 6 — Profil & studio
- **Kundprofil:** som idag (designer, sparade try-ons, bokningar, konto) men i nya stilen, tydliga sektioner.
- **Studiopanel:** egen tydlig arbetsyta märkt "STUDIO MODE", grupperade flikar:
  - Kom igång (guide)
  - Förfrågningar & bokningar (kalender, tider)
  - Pengar (depositioner, betalningar, Fortnox, utbetalning)
  - Profil & galleri (motiv, bilder, öppettider, team)
  - Verktyg (Posture Pro m.m.)
- Studiosidor för kunder (/studios, studiodetalj, bokning) får samma stil; kund ser aldrig studioverktyg.
- En synlig växlare "Kundvy / Studio" för användare som är studio.

## Tekniska detaljer
- Fonts via `<link>` i `src/routes/__root.tsx`; tokens i `src/styles.css` (oklch, `@theme inline`), `--font-display` Anton, `--font-sans`/`--font-mono` DM Mono.
- Ersätt hårdkodade färgklasser i berörda sidor med semantiska tokens.
- `BottomNav.tsx` skrivs om; ny `src/routes/create.tsx` och `src/routes/discover.tsx` som hubbar som länkar till befintliga rutter (`/library`, `/rita`, sleeve builder, `/studios`, `/community`).
- `TryOnStartMenu.tsx` omformas till tvådelat startläge; samma intents till ARCamera som idag.
- `profile.index.tsx` och `artists.dashboard.tsx` omstruktureras (flikgruppering), ingen data-/backendändring.
- Orörda: `ARCamera.tsx`, `flowLock.ts`, `limbCenterline.ts`, `limbCylindricalUv.ts`, bodyWrap, OpenCV, Model3DViewer-logik.
- Verifiering: typcheck, `bun test` (16/16), build, Playwright-skärmbilder av varje sida i mobilvy.
