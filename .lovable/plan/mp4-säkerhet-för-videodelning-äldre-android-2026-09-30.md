# MP4-säkerhet för videodelning (äldre Android)

## Bakgrund
Videor spelas in som MP4 när webbläsaren stödjer det (iPhone och moderna Android-telefoner). Äldre Android-webbläsare spelar in WebM, vilket Snapchat/vissa appar kan vägra att läsa in. Användaren vill att videor alltid delas som MP4.

## Så fungerar inspelningarna idag
Alla videoinspelningar (Live AR, reaction cam, 3D-scan, reveal, before-after) spelas in utan ljudspår från canvas via MediaRecorder — därför räcker ren videokonvertering, inget ljud behöver muxas.

## Plan

1. **Nytt bibliotek:** installera `mediabunny` (ren JS, stödjer WebM-inläsning + MP4-muxning i webbläsaren).

2. **Ny modul `src/lib/videoTranscode.ts`:**
   - `ensureMp4(blob: Blob): Promise<Blob>` — om bloben redan är MP4 returneras den oförändrad.
   - Om WebM: konvertera till MP4 (H.264) via mediabunnys Conversion-API.
   - Biblioteket läses in med dynamisk `import()` först när en WebM-fil faktiskt ska konverteras (påverkar inte laddningstid för MP4-telefoner).
   - Vid fel (för lång video, minne, stöd saknas) returneras original-WebM — delningen går ändå igenom.

3. **Koppla in centralt i `src/lib/share.ts`:** i `shareFile`, `saveToCameraRoll` och `postToApp` — innan filen skapas anropas `ensureMp4` för video-blobbar (WebM → MP4, filnamnets ändelse uppdateras till `.mp4`).
   - Det täcker alla delningsflöden med ett ställe: delningspanelen, röst-/reaction-länkar, Live AR-video, 3D-scan, reveal, before-after, studiomotiv och Snapchat-flödet.

4. **Verifiering:**
   - Bunx tsgo --noEmit + build grönt.
   - AR-testerna (19/19) går igenom.
   - Playwright: tvinga fram en WebM-blob och kör konverteringen, verifiera att utdatan är en spelbar MP4 (`video/mp4`) och att delningsflödet inte kastar fel.

## Påverkan
- Inga ändringar i AR-motorn, kameran eller inspelningen — bara steget innan delning.
- MP4-telefoner märker ingen skillnad; WebM-telefoner får en kort konverteringsstund (med fallback till WebM om den misslyckas).
