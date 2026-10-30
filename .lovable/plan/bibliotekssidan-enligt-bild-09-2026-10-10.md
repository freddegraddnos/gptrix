# Bibliotekssidan enligt bild 09

Omgörning av `/library` (nuvarande "Catalog / Designs"-sida, bild 08) till den nya layouten i bild 09. Byggs i ett separat utkast — inget publiceras.

## Ny layout (enligt referensbilden)

- **Rubrik:** kickertext "DISCOVER", stor Anton-rubrik "FIND YOUR NEXT INK", underrubrik "Find a design that feels like you."
- **Sökfält** högst upp: "Search designs…" (befintlig söklogik återanvänds).
- **Stil-chips** direkt under söket: All + stilar (Fineline, Blackwork, Botanical m.fl. från befintliga STYLES). Aktiv chip fylld violett (#8A5BF2), övriga konturer.
- **Genvägsrad:** "Saved" (bokmärken), "My designs" (egna motiv), "Create a design ↗" (länk till /create).
- **Sektionsrubrik:** "Selected for inspiration" ovanför rutnätet.
- **Kortrutnät (2 kolumner):** motivbild på ljus yta, bokmärkesikon uppe till höger, stil i mono-caps under bilden, motivnamn, "View design →"-länk.

## Vad som flyttas eller tas bort från toppen

- Verktygskorten (AI Generator, Sleeve Builder, Create your own tattoo, Drawing Studio, Try It On Me, Paste tattoo on a picture) tas bort från bibliotekssidan — de finns redan på den nya /create-sidan. "Create a design ↗" i genvägsraden ersätter dem.
- Befintlig funktionalitet behålls: sök, stilfilter, kategorifilter, bokmärken, köpta, dolda motiv, My designs, marketplace-kort.

## Ramar

- Endast `src/routes/library.tsx` (och ev. små hjälpkomponenter) ändras. Inga andra sidor, ingen AR, inga motorer.
- Svart/vitt/violett-tema, Anton + DM Mono, enligt referensen.
- Verifiering: typecheck, build-logg, Playwright på mobil (390 px) och desktop (1280 px) — sök, filter och kortklick testas.
- Ingen publicering — utkastet godkänns av Fredrik först.
