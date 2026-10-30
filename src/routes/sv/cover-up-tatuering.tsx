import { createFileRoute, Link } from "@tanstack/react-router";
import { seo } from "@/lib/seo";
import { SvLanding, faqLd, type Faq } from "@/components/SvLanding";

const PATH = "/sv/cover-up-tatuering";
const TITLE = "Cover up tatuering – testa motiv över gammal tatuering | InkSimulator";
const DESC =
  "Planerar du en cover up? Lägg nya motiv ovanpå ett foto av din gamla tatuering eller prova i AR. Se vilken storlek och vilka motiv som kan täcka innan du bokar.";

const FAQ: Faq[] = [
  { q: "Vad är en cover up tatuering?", a: "En cover up är en ny tatuering som görs ovanpå en befintlig tatuering för att dölja eller förvandla den. Det nya motivet planeras så att mörkare partier och detaljer täcker de gamla linjerna." },
  { q: "Hur stor måste en cover up vara?", a: "Ofta behöver det nya motivet vara tydligt större än den gamla tatueringen så att tatueraren får utrymme att dölja konturerna. Exakt storlek beror på den gamla tatueringens färg, mörkhet och placering – stäm av med tatueraren." },
  { q: "Vilka motiv passar bäst för cover up?", a: "Motiv med mörka ytor, skuggning och många organiska former brukar fungera bra, till exempel blommor, djur, japanska motiv och blackwork. Ljusa färger och fineline täcker sällan svart bläck." },
  { q: "Kan jag testa en cover up innan jag tatuerar mig?", a: "Ja. Ta ett foto av den gamla tatueringen, lägg nya motiv ovanpå i fotoläget och justera storlek och placering. Det är ett digitalt förslag – tatueraren avgör slutligen vad som täcker." },
  { q: "Behöver jag laserbehandling före en cover up?", a: "Inte alltid. En mycket mörk eller stor tatuering kan ibland behöva blekas med laser först för att ge fler motivval. Fråga en tatuerare som gör cover ups." },
  { q: "Kan vilken tatuerare som helst göra en cover up?", a: "Cover ups kräver erfarenhet. Välj gärna en tatuerare som visar cover ups i sin portfolio och ta med bilder från din digitala provning." },
];

export const Route = createFileRoute("/sv/cover-up-tatuering")({
  head: () => seo({ path: PATH, title: TITLE, description: DESC, lang: "sv", breadcrumb: "Cover up tatuering", jsonLd: [faqLd(FAQ)] }),
  component: Page,
});

function Page() {
  return (
    <SvLanding
      current={PATH}
      kicker="Cover up"
      h1="Cover up tatuering – se vad som täcker innan du bokar"
      intro="Vill du dölja eller förnya en gammal tatuering? Lägg nya motiv ovanpå ett foto av den och jämför storlek, form och placering innan du går till studion."
      primary={{ to: "/photo-tryon", label: "Testa på foto av din tatuering" }}
      secondary={{ to: "/ar", label: "Prova i AR" }}
      faq={FAQ}
    >
      <h2>Så testar du en cover up i fyra steg</h2>
      <ol>
        <li><strong>Fotografera den gamla tatueringen</strong> rakt framifrån i bra ljus.</li>
        <li><strong>Ladda upp fotot</strong> i fotoläget och välj ett motiv ur biblioteket eller skapa ett eget.</li>
        <li><strong>Skala upp och flytta motivet</strong> tills de mörka delarna ligger över de gamla linjerna.</li>
        <li><strong>Spara bilderna</strong> och ta med dem till en tatuerare som gör cover ups.</li>
      </ol>

      <h2>Tumregler för en lyckad cover up</h2>
      <ul>
        <li><strong>Större än originalet</strong> – det nya motivet behöver oftast ta mer plats än det gamla.</li>
        <li><strong>Mörkt täcker ljust</strong> – svart och mörka nyanser döljer gammalt bläck, ljusa färger gör det sällan.</li>
        <li><strong>Organiska former</strong> – blad, fjädrar, vågor och skuggor bryter upp gamla raka linjer och text.</li>
        <li><strong>Placering kan flyttas</strong> – motivet behöver inte ligga exakt centrerat över den gamla tatueringen.</li>
      </ul>

      <h2>Motiv som ofta fungerar som cover up</h2>
      <ul>
        <li><Link to="/sv/tatuering-blommor">Blommor</Link> och <Link to="/sv/tatuering-ros">rosor</Link> – täta kronblad och skuggning.</li>
        <li><Link to="/sv/djur-tatuering">Djur</Link>, till exempel <Link to="/sv/tatuering-varg">varg</Link> och <Link to="/sv/tatuering-fagel">fåglar</Link> – päls och fjädrar döljer mycket.</li>
        <li><Link to="/sv/japansk-tatuering">Japanska motiv</Link> – stora mörka bakgrunder med vågor och moln.</li>
        <li><Link to="/sv/realistisk-tatuering">Realistiska motiv</Link> – mjuk skuggning som kan bygga över gamla partier.</li>
      </ul>

      <h2>Vanliga cover up-situationer</h2>
      <ul>
        <li>Namn på en tidigare partner som ska bort.</li>
        <li>Blekt eller utflytande gammal tatuering.</li>
        <li>Tribal, text eller små symboler som inte längre känns rätt.</li>
        <li>En misslyckad tatuering som behöver räddas.</li>
      </ul>

      <h2>Från test till bokning</h2>
      <p>När du hittat en riktning kan du <Link to="/sv/boka-tatuering">skicka en förfrågan till en godkänd studio</Link> och bifoga dina bilder. Den digitala provningen är ett placeringsförslag – tatueraren bedömer vad som faktiskt täcker och gör den slutliga skissen. Läs även om <Link to="/sv/pris-tatuering">vad som påverkar priset</Link>.</p>
    </SvLanding>
  );
}
