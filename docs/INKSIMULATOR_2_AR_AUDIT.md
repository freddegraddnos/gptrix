# AR dependency and regression map

This is a source inspection of the GitHub checkout; it does not establish that the inaccessible uploaded ZIP matches this revision. No camera or physical-device behaviour has been verified by this audit.

## Entry points and engines

- `src/routes/ar.tsx` owns `/ar`, the camera permission primer, motif selection, engine switching and classic fallback. `src/lib/deepar.ts` sets the actual default to `classic`. `?engine=deepar` and `?engine=mediapipe` opt into the alternatives; both fail back to classic. This actual setting differs from the AGENTS.md description. Do not change the default or the fallback as a side effect of navigation work.
- `src/components/ARCamera.tsx` is the classic implementation. Its camera capture, tracking, rendering, controls, save/share and booking handoff are coupled. The archival snapshot is `archive/ARCamera.original.tsx.txt`; it is a separate reference and should not be assumed byte-identical to the current implementation.
- `src/components/DeepARViewer.tsx` uses `deepar`, `@mediapipe/tasks-vision`, One Euro filtering, segmentation and pseudo-depth. DeepAR is hostname-keyed in `src/lib/deepar.ts`; its SDK assets and MediaPipe WASM use jsDelivr, and the pose model uses storage.googleapis.com. Localhost lacks a configured DeepAR key; failure falling back is expected and does not validate DeepAR.
- `src/components/MediaPipeViewer.tsx` dynamically imports `src/lib/mpEngine.ts`, `mpScene.ts` and `mpProjection.ts`; these use MediaPipe pose and Three.js. Its model assets load from jsDelivr.

## Indirect contracts to protect

- `src/router.tsx`, `src/routeTree.gen.ts`, `src/routes/__root.tsx` and `src/styles.css` affect routing, provider setup, viewport, stacking, touch gestures, canvas dimensions and theme. Scope new styles; do not apply studio rules to camera/media/canvas descendants.
- The classic pipeline imports `arTracker`, `flowLock`, `lockPoseController`, `lockedMotifShape`, `opencvLoader`, `bodyWrap`, `curveEstimate`, `limbAxis`, `scaleCalibration`, `skinTone`, `surfaceProfile`, `surfaceProfileStore` and `videoRecording`. Preserve lock behaviour: motif bitmap, wrap and geometry freeze while tracked pose moves. `ScaleCalibrator` and `/calibrate` influence size.
- Route search passes motif IDs and share parameters through `useMotifSearch`/`useArShareSearch`. Library, shop, generator, own designs, photo try-on, studio pages and shares link to `/ar`. Marketplace UUID images come from `useMotif`; generated images use session key `inkvision.generated.motif`; `my_` designs use `myMotifs`. Preserve URLs, image handling and storage keys.
- AR booking uses `inkvision.booking-handoff`, read by `src/routes/$handle.book.tsx` and `src/routes/boka.multi.tsx`; `pendingBooking`, authentication and project state also support resumption. Avoid clearing or replacing state when changing customer navigation.
- External library versions and model URLs are runtime dependencies; browser camera permission, secure context, actual camera, graphics and network are needed for genuine end-to-end checks.

## Baseline SHA-256 for key files

These values record the checkout as inspected before implementation, not proof of equivalence to the uploaded archive:

```
630ce420a687004313b4838e3c390feeea73fa78103be4e12e87e50dcb899f73  src/routes/ar.tsx
a3971af72d5f6c5a9043b0e71aa6293d6bfa21da18fc247d1aa6346949525cce  src/components/ARCamera.tsx
2e4a972d2bf10abf47683e8a2c10a104ae5aebba8a19af670055a81dfbb79c1b  src/components/DeepARViewer.tsx
bef2dbb11c6f1b45c7c4c98a1afa7da7d70c07cf32304d2ae1545130f3b55536  src/components/MediaPipeViewer.tsx
629f100cb59aa50ea039a51874908ea8c87f8f2d881ad53dcac97a6e414a1438  src/lib/deepar.ts
f66643a6c4c83e9ecb931cc2579a52214b4f6caecf4b1757400e453c2b7f0a1c  src/lib/arTracker.ts
584e39faf0b80ecf0f3aea14cb4c98fcf8da63cc429aeb6fb7d1fed208d6a437  src/lib/flowLock.ts
5cb8d92a7f5b6f2196d325a6cce189f6c857ea5b27b3201f252251ad8592ea81  src/lib/lockedMotifShape.ts
67493583e69b2b242ea1f9644f97a3527de3b04ca90cf38a8e5fccc384b1953f  src/lib/lockPoseController.ts
79a2082bd799725b9994aaa41db57cb678306c5b26678b303ed0dabf5686ba90  src/lib/bodyWrap.ts
461c1189dfaf1477d072b97efdaa36fdf929519412f8f122caa7ee992f5ecdd9  archive/ARCamera.original.tsx.txt
```

## Regression checks

The existing `tests/bodyWrapShape.test.ts`, `tests/lockedMotifShape.test.ts`, `tests/lockPoseController.test.ts` and `tests/depthBody.test.ts` import `bun:test` and need Bun. `tests/motifPlacement.test.ts`, `tests/limbCenterline.test.ts` and `tests/limbCylindricalUv.test.ts` import Vitest, which is not declared in the repository dependencies. Run each with its correct runner when available, plus the normal build; review baseline failures separately. Baseline run: Bun 1.3.3 passed all 25 tests across the four Bun files; isolated Vitest 3.2.4 with Three.js 0.185.1 passed all 11 tests across the three Vitest files. The Vitest installation and alias configuration were outside the project checkout; no project dependency files were changed. These are unit tests and do not verify camera operation.

To compare the files above from the repository root without changing them, run:

    awk '/^```/{f=!f;next} f{print}' docs/INKSIMULATOR_2_AR_AUDIT.md | sha256sum -c

A changed file requires review; this check cannot establish runtime correctness or protect dependencies outside the listed paths.

On a physical mobile device over HTTPS, explicitly test camera permission and denial, front/rear switching, motif selection from library/own/generated/shop, transparent image handling, drag/pinch/rotation, calibration, lock while moving, snapshot/share, and handoff to the intended studio booking. Check the two optional engines and fallback on supported hostnames with available models. Desktop source inspection or unit tests do not establish real camera tracking or mobile performance.
