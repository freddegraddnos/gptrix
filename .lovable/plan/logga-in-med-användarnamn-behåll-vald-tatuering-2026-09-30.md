# Logga in med användarnamn + behåll vald tatuering

## Vad du får
1. **Bilden försvinner inte längre.** Om du trycker "Skicka till studio" utan att vara inloggad sparas bilden (med och utan tatuering), motivet och vilken studio du valde på telefonen. Efter inloggningen kommer du tillbaka direkt till samma bokning med bilden kvar.
2. **Nytt inloggningsalternativ: användarnamn + lösenord.** På inloggningssidan finns en flik "Användarnamn". Första gången väljer du användarnamn och lösenord (konto skapas direkt, ingen e-post behövs). Nästa gång loggar du in med samma användarnamn och lösenord.
3. **Förblir inloggad på enheten tills du loggar ut.** "Kom ihåg mig" är förvalt och gäller alla inloggningssätt.

Begränsning: den som bara har användarnamn kan inte återställa glömt lösenord via e-post (det finns ingen e-post). Man kan lägga till e-post senare under Profil.

## Tekniska detaljer
- `src/lib/pendingBooking.ts` (ny): sparar utkast i IndexedDB (bilder är för stora för localStorage) — studio-id, projekt/motiv, före/efter-bilder, fältvärden, retur-sökväg. Rensas efter lyckad bokning eller efter 24 h.
- `BookingDialog.tsx`, `photo-tryon.tsx` (saveAndBook), `ARCamera.tsx` (onRequireAuth), `boka.$handle.tsx`: spara utkast före navigering till `/auth?redirect=<nuvarande sida>`; när sidan laddas igen inloggad återställs utkastet och bokningsdialogen öppnas.
- Användarnamnskonto: server-funktion `signUpWithUsername` (validerar 3–20 tecken a–z0–9_, unikt mot `profiles.handle`) skapar användaren med syntetisk e-post `<namn>@users.inksimulator.com`, bekräftad direkt via admin-anrop — ingen global ändring av e-postbekräftelse. Sätter `profiles.handle` + `username_set`. Inloggning: klienten gör `signInWithPassword` med samma syntetiska e-post (ingen uppslagning av riktiga e-postadresser).
- `auth.tsx`: ny flik Användarnamn (Logga in / Skapa konto), `remember` förvalt till sant; sessionen ligger kvar i webbläsaren tills utloggning.
- AR-motorn orörs; ARCamera ändras bara i inloggningsknappens callback.
