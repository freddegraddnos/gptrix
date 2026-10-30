# Tio japanska tatueringsmotiv

## Mål
Tio nya japanska motiv, rensade från vitt (även inuti), tight beskurna, korrekt kategoriserade och publicerade i biblioteket, Sleeve Builder och galleriet — samma flöde som tidigare batcher (601–666).

## Motiv (10 klassiska japanska motiv, svart/grå)
1. Koi-karp uppströms
2. Oni-mask
3. Drage (ryu) lindad
4. Kirschblommor (sakura) gren
5. Hannya-mask
6. Fenix (ho-oo)
7. Vågor (Hokusai-stil)
8. Tiger bland bambu
9. Geisha-porträtt
10. Chrysanthemum (kiku)

## Genomförande
1. Generera 10 motiv i svart/grå japansk tatueringsstil (bold outlines, gråskuggning, solid vit bakgrund) till `src/assets/` som PNG.
2. Kör rensningspipelinen per motiv: adaptiv vitrensning även inuti slutna ytor (alla nästan-vita pixlar → transparenta, bleka toner tonas stegvis), MedianFilter, alpha-bbox-beskärning.
3. Kvalitetskontroll: noll ogenomskinliga nästan-vita pixlar; förhandsgranskning mot mörkt och hudfärgat underlag; ljusaste kvarvarande ytor under gränsen (som efter ögon/dödskalle/häst-fixen).
4. Lägg till 10 poster i `src/lib/tattoos.ts` (fortsatt numrering från 666) med korrekt kategori (Animals/Symbols/Flowers/Realistic/Patterns m.m.).
5. Ladda upp rensade PNG:er till marketplace-bucketen under studio-ID `88ed7336-e73b-489a-9c62-7f275bfee3ce` och skapa publicerade fria rader i `marketplace_motifs` (samma mönster som tidigare migrationer 0023–0026 — behövs ny tabellrad: via supabase--run_sql INSERT).
6. Kategorierna kopplas automatiskt vidare till biblioteksfilter och Sleeve Builder via befintlig kataloglogik.

## Tekniska detaljer
- Rensningsskript: återanvänd `/tmp/inkvision-motifs/clean-*.py`-mönstret (PIL, per-pixel luminanströskel med mjuk övergång, border flood-fill avstängd för inre ytor).
- Marketplace-rader: `INSERT INTO marketplace_motifs (studio_id, title, style, category, price_cents=0, image_path, published=true)` — gratis/marknadsföring.
- AR-låset rörs inte.

## Verifiering
- Pixelmätning: 0 nästan-vita ogenomskinliga pixlar per fil.
- `bun test`, `tsgo --noEmit`, grön build.
- Visuell kontroll mot mörk och hudfärgad bakgrund för varje motiv.
