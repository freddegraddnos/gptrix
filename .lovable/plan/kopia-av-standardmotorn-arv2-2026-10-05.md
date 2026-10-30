# Kopia av standardmotorn: /arv2

## Vad som görs (endast detta)
1. En exakt kopia av Classic-kameran (den som körs på /ar idag) skapas som en egen fil, ARCameraV2. Originalet rörs inte.
2. En ny sida, /arv2, som fungerar exakt som /ar idag (samma motivlänkar, egna motiv, AI-motiv, delade länkar och samma gränssnitt) men använder kopian.
3. /arv2 göms för Google (noindex) och läggs inte i menyer eller sajtkarta, så det bara är du som når den via adressen.

## Vad som INTE görs nu
- Inga ändringar i /ar, Classic, DeepAR eller MediaPipe.
- Tvåstegslåset (klick 1 = placera, klick 2 = följ huden) och 3D-teknikerna (DensePose, SMPL-X, djupkarta, normaler, Fresnel, ljus, konform projektion) byggs inte nu. De kan göras som separata steg i /arv2 när du ger order om det.

## Tekniskt
- `src/components/ARCameraV2.tsx`: byte-identisk kopia av `src/components/ARCamera.tsx`, endast export-namnen byts (`ARCameraV2`, egna hjälp-hooks importeras från originalet där de redan delas).
- `src/routes/arv2.tsx`: kopia av `src/routes/ar.tsx` utan engine-växling (alltid V2), head med `robots: noindex`.
- Ingen databas- eller nätverksändring.
