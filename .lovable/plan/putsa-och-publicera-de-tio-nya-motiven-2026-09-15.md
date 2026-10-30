# Putsa och publicera de tio nya motiven

## 1. Rensa varje bild för hand och maskinellt

De tio uppladdade bilderna behandlas individuellt, inte med en blind gemensam tröskel:

- Ta bort vit bakgrund och vita fält inne i motivet till full transparens.
- Bevara svart bläck, tunna linjer och realistisk gråskuggning.
- Bleka grå toner tonas mjukt mot transparens så att inga vita plattor syns i AR.
- Rensa vita hål även mellan fjädrar, päls, flätor, vågor, horn och runor.
- Beskär varje motiv tätt efter synligt bläck med en liten jämn säkerhetsmarginal.
- Kontrollera mot både ljus och mörk bakgrund, samt med pixelkontroll för kvarvarande opaka nästan-vita ytor.

De två tigerbilderna behålls som separata motiv eftersom poserna skiljer sig.

## 2. Namnge och kategorisera rätt

Motiven registreras med egna namn, sökord, realistisk bredd och rätt kategori:

- Celtic Raven Wings — **Animals**, Blackwork
- Yggdrasil & Ravens — **Symbols**, Blackwork
- Lion Portrait — **Realistic**, Blackwork
- Owl Portrait — **Realistic**, Blackwork
- Hannya & Waves — **Symbols**, Traditional
- Celtic Ouroboros — **Symbols**, Geometric
- Eagle Portrait — **Realistic**, Blackwork
- Stag Portrait — **Realistic**, Blackwork
- Prowling Tiger — **Realistic**, Blackwork
- Walking Tiger — **Realistic**, Blackwork

De läggs både i det fasta designbiblioteket/sleeve buildern och i det publika galleriet. I galleriet publiceras de gratis under den godkända studion **1891frs**, eftersom inget pris angavs.

## 3. Publicera samma rena original på rätt sätt

- De putsade PNG-filerna sparas som riktiga appbilder och används i biblioteket, sleeve buildern och AR.
- Samma rena filer laddas upp till galleriets lagring och får varsin publicerad galleri-post med namn, stil, kategori och relevanta sökord.
- Publiceringen görs som en reproducerbar seed/import så motiven inte försvinner vid en ny miljö eller ominstallation.
- Gratismotiven visas utan vattenstämpel och går att spara och prova direkt.

## 4. Gör gallerisökningen tydlig och hjälpsam

Den befintliga textsökningen behålls men görs mer användbar:

- Sök på motivnamn, studio, stil, kategori och sökord.
- Lägg till kategori-filter bredvid stilfiltret, inklusive Animals, Realistic och Symbols.
- Visa träffantal och en tydlig återställning när filter ger få eller inga resultat.
- När det finns högst fyra träffar visas två tydliga alternativ:
  - **Upload a screenshot** → öppnar befintliga uppladdningsflödet som automatiskt tar bort vitt och sparar motivet i My designs.
  - **Create with AI** → öppnar den befintliga AI-generatorn.
- Vid noll träffar ersätter alternativen den nuvarande passiva tomtexten, utan att dölja sökordet eller filtren.

## 5. Kontroll före leverans

- Visuell jämförelse av samtliga tio bilder före/efter på ljus och mörk yta.
- Pixelkontroll: inga opaka vita eller nästan-vita bakgrundsfält; grå skuggning och fina konturer kvar.
- Kontrollera att alla tio hittas genom namn, kategori och relevanta sökord.
- Kontrollera mobilvyer för galleri, bibliotek och sleeve builder samt öppning i AR.
- Kör typkontroll, tester och appens byggkontroll.

## Tekniska detaljer

- Bildbehandling med adaptiv luminans/alpha-mask per bild, hålrensning och alpha-bbox med liten marginal; originaluppladdningarna lämnas orörda.
- Nya tillgångar registreras i `TATTOOS` med unika id:n/koder och läggs även in i `marketplace_motifs` med lagringssökvägar under 1891frs-kontot.
- Galleriets datamodell kompletteras med kategori om den saknas, inklusive åtkomstregler och typer; sökningen utökas över det nya fältet och tags.
- Befintliga flöden `/try-it-on` och `/generator` återanvänds; ingen ny parallell uppladdare eller generator byggs.
- AR/OpenCV-låset ändras inte.
