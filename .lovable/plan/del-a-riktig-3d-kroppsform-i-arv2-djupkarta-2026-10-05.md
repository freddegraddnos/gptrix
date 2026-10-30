# Del A: Riktig 3D-kroppsform i /arv2 (djupkarta)

## Vad som byggs (endast detta)

Riktig 3D-kroppsform i realtid i **/arv2**, driven av en djupkarta (monokulär djupuppskattning). Motivet läggs inte längre på en platt bild — det böjs och skuggas efter kroppens verkliga form varje bildruta.

Viktig ärlighet: **DensePose går inte att köra i webbläsaren** — det finns ingen fungerande port av den modellen till webben. Vägen som faktiskt fungerar är en djupkarta: Depth Anything V2 (small), som körs helt i webbläsaren och som andra sajter använder för AR-förhandsvisningar. Den ger relativt djup per pixel — kroppens form — vilket är det som driver 3D-känslan.

## Vad du som användare ser

1. Du öppnar **/arv2** som vanligt. Första gången djupmotorn behövs laddas en modell på cirka 100 MB (en gång, sparas sedan i webbläsaren). En liten "Laddar djupmotor …" status visas under nedladdningen.
2. Motivet ligger nu efter kroppens form: det buktar ut på armens mitt och drar ihop sig mot kanterna, även när armen böjs.
3. Motivet skuggas med kroppen — där huden mörknar (vänd bort från ljuset) mörknar bläcket.
4. En **Debug**-knapp visar djupkartan som en värmeskinning så du kan kontrollera att formen stämmer.
5. Låset fungerar precis som idag: klick fryser motivets form och storlek, spårningen flyttar bara det.

## Vad som INTE görs

- Inga ändringar i **/ar**, Classic-kameran (`ARCamera.tsx`), `DeepARViewer` eller `MediaPipeViewer`.
- Ingen SMPL-X, ingen DensePose, inga ändringar i UI/menyer, betalning eller navigering.
- Ingen ändring av låslogik, motivval, delningslänkar eller foto/video.
- /arv2 förblir noindex, utanför menyer och sajtkarta.

## Tekniskt

- **Mask (kroppskontur):** återanvänd `src/lib/personSegmentation.ts` (MediaPipe, lazy CDN) — samma mönster som DeepAR-vyn redan använder.
- **Ny modul `src/lib/depthBody.ts`:**
  - Depth Anything V2 small via transformers.js, lazy-importerad från CDN (aldrig i huvudpaketet — projektet byggs för edge/Cloudflare).
  - Kör på nedskalad bild (≈512 px), strypt till var ~250 ms — inte varje bildruta.
  - Djupet normaliseras inuti personmasken och jämnas ut med One Euro-filter.
  - Fallback: om WebGPU/WASM-inferens misslyckas eller modellen inte laddar, används den befintliga `pseudoDepth()`-mätningen (kammardistans från masken) — sidan fortsätter fungera utan nerladdning.
- **Ny WebGL-layer i `ARCameraV2.tsx` (endast V2-kopian):**
  - En WebGL-canvas ovanpå videon som warpar motivet med djupkartan (port av den beprövade shader-metoden från DeepAR-vyn, utökad med normaler från djupets gradient för skuggning).
  - Befintliga värden (kurvatur, taper, lutning, ljus) från `surfaceProfile`/`bodyWrap` skickas som shader-uniforms — samma geometri som idag.
  - När djupet inte är tillgängligt: dagens CSS/bake-pipeline används oförändrat.
  - Låset fryser geometrin; spårad pose flyttar bara motivet (befintlig invariant).
- **Debug:** djupheatmap-toggle i V2-vyn.
- **Tester:** deterministiska enhetstester i `tests/` för de rena funktionerna: djup→warp-parametrar (syntetisk djupkarta → förväntad buktning), djupgradient→skuggning, och fallback-vägen pseudoDepth→warp. Inga kameradependenta tester.
- Typecheck (`tsgo`), testkörning och build verifieras; sidan öppnas i testwebbläsare (fejkad kamera) utan fel.
