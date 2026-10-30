# Fixa svart skärm i Live AR

## Orsak (från dina skärmdumpar)
DeepAR svarar "license not valid" på www.inksimulator.com. Då ritar DeepAR ingen kamerabild, så skärmen blir svart. Felet stoppar inte heller vyn, så den klassiska kameran tar aldrig över. Nyckeln är troligen bara registrerad för en adress utan "www" eller för en annan domän i DeepAR-portalen.

## Ändringar
1. **Klassiska kameran blir standard igen** på /ar, så Live AR fungerar direkt för alla.
2. **DeepAR blir valfritt testläge** som öppnas med `/ar?engine=deepar`. Du kan testa det tills licensen fungerar, utan att besökarna påverkas.
3. **Automatisk reserv:** om DeepAR säger "license not valid" (eller ingen bild kommer inom ca 3 sekunder) stängs DeepAR-vyn och den klassiska kameran startar. Ingen popup visas.
4. **Reglagen tas bort** (Size, Rotate, Position och "Use classic camera"). Motivet placeras automatiskt.

## Det här gör du
Enligt DeepARs guide gäller en nyckel bara för en enda domän. Skapa därför ett gratis DeepAR-projekt för varje adress och skicka nycklarna till mig:
- `www.inksimulator.com` (huvudadressen)
- `ar-ink-canvas.lovable.app` (publicerad)
- `id-preview--78382135-b5d4-4b76-84d2-3a0c421e9e68.lovable.app` (förhandsvisning)

Appen väljer sedan rätt nyckel utifrån adressen. På adresser som saknar nyckel används den klassiska kameran direkt.

## Tekniskt
- `AR_ENGINE = "classic"` i `src/lib/deepar.ts`. `ar.tsx` läser `?engine=deepar` och ignorerar inte det sparade "classic"-valet.
- `DEEPAR_KEYS: Record<hostname, key>` med `getDeepArKey(location.hostname)`. Saknas nyckel för adressen anropas `onFail("no-key")` direkt.
- Nyckeln `ad6c1f0f…587412d` mappas till `www.inksimulator.com` och `e0528d83…23e2a9f8` till `ar-ink-canvas.lovable.app`. Förhandsvisningen saknar egen nyckel och använder därför den klassiska kameran tills en nyckel finns.
- I DeepARViewer: fånga `window.alert` medan DeepAR initieras och tolka licenstext som `onFail("license")`. Lägg också till en watchdog som läser en pixel från DeepAR-canvasen eller kontrollerar ett första renderat event, och anropar `onFail("no-frame")` om inget kommer inom 3 s.
- Ta bort reglagepanelen och deras state. Behåll storlek 1, rotation 0 och position 0.5 som fasta värden.
- `ARCamera.tsx` ändras inte.
