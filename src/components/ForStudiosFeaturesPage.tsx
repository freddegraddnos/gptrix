import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUp, ArrowUpRight, ChevronDown, Mail, Phone } from "lucide-react";
import { StudioTrackHeader } from "@/components/StudioTrackHeader";
import { useStudioTheme } from "@/lib/studioTheme";
import imgPreview from "@/assets/guide/ar-preview.png";
import imgStudios from "@/assets/guide/community-studios.png";
import imgBookings from "@/assets/guide/dashboard-bookings.png";
import imgGallery from "@/assets/guide/dashboard-gallery.png";
import imgProfile from "@/assets/guide/dashboard-profile.png";
import imgDesigns from "@/assets/guide/dashboard-designs.png";

export type Lang = "en" | "sv";
const languageKey = "inksimulator.public-studio-lang";
const contact = "tel:+46793288098";
const chapters: Record<Lang, string[]> = {
  sv: ["Fler kunder","Nöjdare kunder","Digital närvaro","Storlek & placering","Stencil & tid","Mindre admin","Fortnox","Bokning & intäkter","Så fungerar det","Pris & start","Vanliga frågor"],
  en: ["More clients","Happier clients","Online presence","Size & placement","Stencil & time","Less admin","Fortnox","Booking & revenue","How it works","Pricing & setup","FAQ"],
};
const chapterIds = ["section-0","section-1","section-2","section-3","section-4","section-5","section-6","section-7","how-it-works","pricing","faq"];
const num = (i: number) => String(i + 1).padStart(2, "0");
function Num({ i, small = false }: { i: number; small?: boolean }) {
  return <span aria-hidden="true" className={`studio-violet-light shrink-0 font-display leading-none text-foreground ${small ? "text-3xl" : "text-5xl sm:text-6xl"}`}>{num(i)}</span>;
}
function ChapterTag({ i, name }: { i: number; name: string }) {
  return <p className="mb-6 flex items-baseline gap-4"><Num i={i} /><span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">{name}</span></p>;
}
const pictures = { preview: imgPreview, studios: imgStudios, bookings: imgBookings, gallery: imgGallery, profile: imgProfile, designs: imgDesigns };
type Picture = keyof typeof pictures;
type Block = { lead?: string; subhead?: string; closing?: string; pointBenefits?: string[]; label?: string; h: string; paragraphs: string[]; points?: { title: string; text: string }[]; highlight?: string; note?: string; image?: Picture; alt?: string; flow?: string[] };
const content: Record<Lang, {
  eyebrow: string; hero: string; sub: string; intro: string[]; benefits: {title: string; text: string}[]; cta: string; demo: string; priceLine: string;
  nav: string; sections: Block[]; proof: { h: string; steps: string[] }; price: { h: string; monthly: string; yearly: string; fee: string; groups: { title: string; text: string }[]; start: string; startText: string; extra: string; note: string; noTech: string; contactHelp: string }; faqTitle: string; faq: { q: string; a: string }[]; closing: string; closingText: string; login: string; guide: string; priceLink: string; top: string; contactNote: string; product: string; visualCaption: string; closingBenefits: string; closingHelp: string;
}> = {
  sv: {
    eyebrow: "FÖR TATUERINGSSTUDIOS", hero: "Fler kunder. Nöjdare kunder. Mindre admin.", sub: "Bli upptäckt tidigare. Hjälp kunden att känna sig säker. Få mer tid att tatuera.",
    intro: ["InkSimulator hjälper människor att utforska tatueringsidéer, prova storlek och placering på sin egen kropp och hitta en studio.", "Ge fler kunder möjlighet att upptäcka ditt arbete. Samla sedan förfrågningar, skisser, bokningar och betalningar på ett ställe — med Fortnox-integration som minskar det manuella bokföringsarbetet."],
    benefits: [
      { title: "Fler vägar till din studio", text: "Nå människor som utforskar sin nästa tatuering, med en offentlig studioprofil som kan upptäckas via InkSimulator, sökmotorer och AI-tjänster." },
      { title: "Bättre förberedda kunder", text: "Låt kunden utforska storlek och placering före besöket. Det ger er en tydligare utgångspunkt för ett resultat kunden känner sig nöjd med." },
      { title: "Mindre jobb runt tatueringen", text: "Minska letandet efter meddelanden, bollandet av bokningstider och den manuella registreringen av betalningar." },
    ], cta: "Anmäl intresse", demo: "Se hur det fungerar", priceLine: "Gratis provperiod under hela 2026.", nav: "Sidans avsnitt",
    sections: [
      { label: "FLER KUNDER", h: "Deras nästa tatuering kan leda dem till din studio.", paragraphs: ["Vissa vet vad de vill tatuera, men har inte valt tatuerare. Andra letar fortfarande efter rätt idé.", "På InkSimulator kan de upptäcka motiv, prova tatueringar på sin egen kropp och hitta studios utifrån stil och plats. Ditt arbete kan bli en del av beslutet innan de väljer vem som ska tatuera dem.", "Ett motiv, en referensbild eller en förhandsvisning ger dig en tydligare utgångspunkt. Ni kan diskutera vad som fungerar, utveckla idén och ta nästa steg mot en bokning."], points: [{title:"Genom ditt arbete",text:"Dina motiv och ditt galleri visar din stil och hjälper kunden att avgöra om du är rätt tatuerare för idén."},{title:"Genom din plats och dina stilar",text:"Studiosökning och karta hjälper kunden att hitta relevanta tatuerare i närheten."},{title:"Från en idé till en förfrågan",text:"Kunden kan utforska en tatuering, hitta din studio och skicka sin idé och förhandsvisning för att inleda en dialog."}], subhead:"Börja med något mer konkret än ”jag funderar på en tatuering”.",closing:"En bokningskalender hjälper när kunden redan har valt dig. InkSimulator hjälper dig också att bli upptäckt medan valet fortfarande görs.",flow:["Utforska en tatuering","Hitta din studio","Skicka en förfrågan","Kom överens om nästa steg"], image:"studios",alt:"InkSimulators studiosökning med karta och studioresultat" },
      { label:"NÖJDARE KUNDER",h:"Du vill att kunden ska älska tatueringen — även storleken och placeringen.",paragraphs:["En kund kan älska ditt arbete och ändå önska att tatueringen hade varit lite mindre eller suttit lite högre.","Ge kunden möjlighet att utforska de besluten före besöket, med tid att jämföra och känna efter.","Med InkSimulator kan kunden se motivet på sin egen kropp, ändra storlek och placering och visa dig vad hen har i åtanke."], highlight:"Bästa tillfället att tänka om kring storleken är innan den är permanent.",subhead:"En tydligare bild av vad kunden vill. Ett bättre samtal om vad som fungerar.",closing:"Hjälp kunden att känna sig nöjd med hela valet, från motivet till hur det sitter.",pointBenefits:["Kunden kan visa sina önskemål. Du kan använda din erfarenhet för att ge råd om proportioner, detaljer och placering.","Den gemensamma bilden hjälper er att stämma av förväntningarna innan ni börjar — och ger bättre förutsättningar för ett resultat kunden känner sig nöjd med."],points:[{title:"För kunden",text:"Större trygghet i hur motivet ser ut på den egna kroppen."},{title:"För tatueraren",text:"En tydligare förståelse för vad kunden förväntar sig."},{title:"För besöket",text:"En gemensam utgångspunkt för att bestämma slutligt motiv, storlek och placering."}],image:"preview",alt:"Verklig förhandsvisning av en tatuering på kroppen i InkSimulator" },
      { label:"STARKARE DIGITAL NÄRVARO",h:"Ge din studio ännu en ingång på nätet.",lead:"Gör ditt arbete lättare att upptäcka — utan att dra igång ett hemsideprojekt.",paragraphs:["Ditt arbete förtjänar att vara lätt att hitta, även om hemsidan inte har uppdaterats på flera år.","Din profil på InkSimulator samlar artister, stilar, plats och arbetsprover, med en tydlig väg till förfrågan eller bokning. Den kompletterar din befintliga hemsida och dina sociala kanaler."],subhead:"När någon ber en AI hitta en tatuerare ska din studio gå att förstå och hitta.",pointBenefits:["Tydlig information om stilar, plats, artister och bokningsprocess hjälper AI-tjänster att bedöma om din studio passar kundens önskemål.","InkSimulator gör informationen och bokningsvägarna tillgängliga, utan att din studio behöver bygga en egen AI-integration."],points:[{title:"En egen sida för din studio",text:"Ge potentiella kunder en plats där de kan se ditt arbete, förstå vad du erbjuder och ta kontakt."},{title:"Fler möjligheter att synas i sökningar",text:"Din offentliga profil ger Google och AI-söktjänster ytterligare en källa till information om din studio, var den finns och vilka tatueringsstilar ni arbetar med."},{title:"Förberett för AI-assisterad sökning och bokning",text:"InkSimulator tillhandahåller strukturerad studioinformation och bokningsvägar som kan användas av AI-tjänster och agenter som stöder flödet."}],highlight:"Ditt arbete. Din studio. Fler vägar till din stol.",image:"profile",alt:"InkSimulators verkliga vy för studioprofil" },
      { h:"”Skulle den passa bättre lite mindre?” Låt kunden se.",paragraphs:["Ett motiv på en skärm visar inte hur det kommer att sitta på kroppen.","Efter kalibrering visar InkSimulators AR-förhandsvisning motivet i avsedd verklig storlek, i skala 1:1. Kunden kan jämföra proportioner och placeringar på sin egen kropp."],points:[{title:"Jämför storleken",text:"Se hur en mindre eller större version förändrar helheten."},{title:"Utforska placeringen",text:"Prova högre upp, längre ner eller i en annan vinkel."},{title:"Visa vad som känns rätt",text:"Ta med förhandsvisningen in i samtalet så att du kan ge råd om vad som fungerar."}],note:"Kunden kan utforska i lugn och ro. Ni bekräftar tillsammans slutlig storlek, placering och lämplighet i studion.",highlight:"Tydligare önskemål före besöket. Mer genomtänkta beslut i studion.",image:"preview",alt:"InkSimulators AR-vy med motiv på kroppen" },
      { h:"Låt första rundan ”större eller mindre?” ske före besöket.",paragraphs:["Prova en annan storlek. Flytta stencilen. Ta ett steg tillbaka och titta igen.","De besluten förtjänar uppmärksamhet. InkSimulator hjälper kunden att börja utforska dem innan besöket, så att ni har en tydligare riktning att arbeta från."],points:[{title:"Före besöket",text:"Kunden provar motivet på sin kropp, jämför storlekar och placeringar och delar det alternativ som känns bäst."},{title:"I studion",text:"Du går igenom önskemålen, ger råd om vad som fungerar och bekräftar den slutliga stencilen tillsammans med kunden."}],highlight:"Bättre förberedelser kan ge färre stenciljusteringar och mindre tid på att börja från noll.",note:"Använd det både med kunder som hittar dig genom InkSimulator och med kunder som redan känner din studio.",closing:"Ge beslutet mer utrymme före besöket — och besöket en tydligare start." },
      { label:"MINDRE ADMIN",h:"Ha koll på kunden utan att leta efter konversationen.",paragraphs:["Referensbilden, den senaste skissen, det ni kommit överens om och bokningsuppgifterna hör ihop.","InkSimulator samlar dem kring kunden, så att du kan fortsätta samtalet utan att leta i flera olika appar."],points:[{title:"Hitta rätt skiss och rätt konversation",text:"Samla förfrågningar, referensbilder, skissversioner och meddelanden i kundens konversation."},{title:"Boka med mindre fram och tillbaka",text:"Ange antal sittningar och hur långa de behöver vara. Skicka sedan en bokningslänk där kunden väljer en ledig tid och betalar deposition i appen."},{title:"Håll koll på kalendern och nya förfrågningar",text:"Anslut Google Kalender så att upptagna tider återspeglas i tillgängligheten. Få aviseringar om nya förfrågningar via SMS, e-post eller båda."}],pointBenefits:["Mindre letande. Bättre koll när du svarar.","Du bestämmer tiden som behövs. Kunden väljer en ledig tid.","Mindre manuell kalenderkontroll. Bättre överblick över inkommande jobb."],highlight:"En kund. En konversation. Ett tydligare arbetsflöde.",image:"bookings",alt:"Verklig vy över bokningar i InkSimulators studiopanel" },
      { label:"MINDRE MANUELL BOKFÖRING",h:"Slipp registrera samma betalning två gånger.",paragraphs:["Spara tid på bokföringen — och minska arbetet som du eller din redovisningsbyrå behöver göra.","En betalning ska inte behöva bli ännu en uppgift efter dagens sista kund.","Anslut ditt Fortnox-konto så att depositioner, tatueringsbetalningar och designförsäljning som stöds av integrationen förs över automatiskt till bokföringen. InkSimulators avgift registreras som en kostnad."],points:[{title:"Spara din egen tid",text:"Minska manuell registrering av betalningar och få mer tid till kunderna, arbetet eller att avsluta dagen."},{title:"Minska arbetet för redovisningsbyrån",text:"Automatiska bokföringsposter kan minska tiden som behöver läggas på transaktionerna. Betalar du för det arbetet per timme kan mindre manuell hantering också sänka kostnaden."},{title:"Få med både betalningar och avgifter",text:"Transaktioner och plattformsavgifter som stöds förs över genom integrationen, så att de blir enklare att kontrollera och följa upp."}],highlight:"Färre manuella registreringar. Mindre arbetstid. Möjlighet till lägre bokföringskostnader.",closing:"Betalning i InkSimulator → Bokföringspost i Fortnox",note:"Fortnox-integrationen ingår. Fortnox-abonnemang köps separat. Bokföringen behöver fortfarande kontrolleras och stämmas av som vanligt." },
      { h:"Du bestämmer sittningarna. Kunden väljer en tid.",paragraphs:["Behåll kontrollen över ditt arbete och gör nästa steg enkelt för kunden.","1. Gå igenom idén","Diskutera motivet och vad kunden vill göra.","2. Bestäm vad besöket kräver","Ange hur många sittningar som behövs och hur lång varje sittning ska vara.","3. Skicka bokningslänken","Kunden väljer en tillgänglig tid och betalar deposition genom bokningsflödet."],subhead:"Tre sätt för kunden att anlita dig",points:[{title:"Tatueringsbokningar",text:"Gå från förfrågan till bokat besök."},{title:"Personliga designförfrågningar",text:"Ta emot idéer och utveckla skisser tillsammans med kunden."},{title:"Försäljning av motiv (Pilot)",text:"Gör dina motiv tillgängliga att köpa på marknadsplatsen."}],image:"designs",alt:"InkSimulators vy för studioägda tatueringsmotiv" },
    ],
    proof:{h:"Se hur det kan fungera i din studio.",steps:["Kunden utforskar storlek och placering.","Kunden hittar en studio.","En förfrågan kommer in med kundens idé.","Studion hanterar konversationen och bokningen."]},
    price:{h:"Det här ingår. Så mycket kostar det. Så kommer du igång.",monthly:"Gratis provperiod under hela 2026",yearly:"",fee:"Ingen fast studioavgift eller provision under provperioden 2026.",groups:[{title:"Bli upptäckt på fler ställen",text:"Studio- och artistprofiler, galleri, närvaro på marknadsplatsen (Pilot) och offentlig information som är tillgänglig för sökmotorer och AI-tjänster."},{title:"Hjälp kunden att välja tryggare",text:"AR-provning av storlek och placering, personliga designförfrågningar, referensbilder och skisser."},{title:"Håll ordning på besöken",text:"Kundkonversationer, planering av sittningar, bokningslänkar, depositioner, Google Kalender och teamhantering."},{title:"Minska manuellt administrativt arbete",text:"Aviseringar till studion och Fortnox-integration för transaktioner som stöds."}],start:"Du tatuerar. Vi hjälper dig att komma igång.",startText:"Vi hjälper dig att skapa studiokontot, lägga till artister och arbetsprover och ställa in tillgängliga bokningstider.",noTech:"Du behöver inga tekniska förkunskaper.",contactHelp:"Kontakta oss så hjälper vi dig att få studion på plats.",extra:"Det här ingår också: Posture Pro för studion.",note:"Priser i SEK. Kontrollera fullständiga villkor, inklusive moms, på prissidan eller när du kontaktar oss."},
    faqTitle:"Vanliga frågor", faq:[
      {q:"Hur hittar nya kunder min studio?",a:"Genom din studioprofil, ditt arbete, din plats och dina tatueringsstilar på InkSimulator. Den offentliga profilen ger också sökmotorer och AI-tjänster information som de kan använda för att hitta och beskriva din studio."},
      {q:"Behöver jag byta hemsida?",a:"Nej. InkSimulator ger kunder ytterligare en väg att hitta ditt arbete och kontakta dig. Det kompletterar din befintliga hemsida och dina sociala kanaler."},
      {q:"Kan AI-agenter boka hos min studio?",a:"Ja, där agentfunktionen är aktiverad för en godkänd studio kan kunden hitta tider och skicka en bokning via studions agent. Kunden bekräftar uppgifter och att hen är minst 18 år. Tiden bekräftas direkt eller inväntar studions godkännande, beroende på studions inställning. Andra AI-tjänster kan också länka till studions bokningssida, men kan inte nödvändigtvis slutföra bokningen själva."},
      {q:"Kan jag använda InkSimulator med mina befintliga kunder?",a:"Ja. De kan utforska storlek och placering före besöket och dela en förhandsvisning som hjälper er att diskutera önskemålen."},
      {q:"Hur kan det bidra till nöjdare kunder?",a:"Kunden får tid att utforska hur motivet ser ut på den egna kroppen och diskutera sina önskemål med dig. Det hjälper er att stämma av förväntningarna på storlek och placering innan ni börjar."},
      {q:"Hur fungerar skala 1:1?",a:"AR-funktionen använder kalibrering för att visa motivet i avsedd verklig storlek. Kunden följer instruktionerna i appen och ni bekräftar de slutliga måtten tillsammans i studion."},
      {q:"Ersätter förhandsvisningen stencilen?",a:"Nej. Den hjälper kunden att utforska sina önskemål i förväg. Du bekräftar slutlig storlek, placering och lämplighet i studion."},
      {q:"Kan kunden ladda upp egna motiv?",a:"Ja. Kunden kan ladda upp och prova ett motiv och sedan diskutera lämplighet och eventuella ändringar med dig."},
      {q:"Bestämmer jag hur lång tid som bokas?",a:"Ja. Du väljer antal sittningar och hur långa de ska vara innan du skickar bokningslänken."},
      {q:"Kan flera tatuerare använda plattformen?",a:"Ja. Du kan lägga till artister och hantera teamets åtkomst inom studion."},
      {q:"Kan jag koppla Google Kalender?",a:"Ja. Anslut Google Kalender så att upptagna tider återspeglas i bokningstillgängligheten."},
      {q:"Kan Fortnox-integrationen sänka våra bokföringskostnader?",a:"Den minskar manuell registrering av plattformstransaktioner som stöds. Det sparar arbetstid och kan minska kostnaderna om du betalar en redovisningsbyrå för arbetet. Besparingen beror på transaktionsvolym och hur din redovisning är upplagd."},
      {q:"Ingår Fortnox i priset?",a:"Integrationen ingår. Fortnox-abonnemang köps separat."},
      {q:"Vad kostar InkSimulator?",a:"Gratis provperiod under hela 2026 utan fast studioavgift eller provision."},
    ], closing:"Hjälp dem att hitta dig. Hjälp dem att känna sig säkra. Få mer tid att tatuera.",closingText:"Ge kunder fler vägar till din studio. Hjälp dem att förbereda ett beslut de känner sig nöjda med. Gör konversationerna, bokningarna och bokföringen enklare att hantera.",login:"Redan ansluten? Logga in till studion",guide:"Läs steg-för-steg-guiden",priceLink:"Se fullständiga priser och villkor",top:"Till toppen",contactNote:"Knappen startar ett telefonsamtal så vi kan hjälpa dig att komma igång.",visualCaption:"Hjälp kunden att se vad som känns rätt innan det blir permanent.",closingBenefits:"Fler kunder. Nöjdare kunder. Mindre admin.",closingHelp:"Vi hjälper dig att komma igång.",product:"InkSimulator är en plattform för att upptäcka tatueringar, prova motiv med AR och administrera en tatueringsstudio. Kunder kan utforska storlek och placering på sin egen kropp, hitta studios och skicka förfrågningar. Studios kan hantera konversationer, skisser, bokningar och depositioner, med Fortnox-integration för betalningar som stöds." },
  en: {
    eyebrow:"FOR TATTOO STUDIOS",hero:"More clients. Happier clients. Less admin.",sub:"Get discovered earlier. Help clients choose confidently. Make more time for tattooing.",intro:["InkSimulator helps people explore tattoo ideas, try size and placement on their own body, and find a studio.","Give clients more ways to discover your work. Keep enquiries, sketches, bookings and payments together, with Fortnox integration to reduce manual bookkeeping."],benefits:[{title:"More ways to find you",text:"Reach people exploring their next tattoo, with a public studio profile that can be discovered through InkSimulator, search engines and AI services."},{title:"Better-prepared clients",text:"Let clients explore size and placement before the appointment, giving you a clearer starting point for a result they feel happy with."},{title:"Less work around the tattoo",text:"Reduce scattered messages, scheduling back-and-forth and manual payment entries."}],cta:"Register your interest",demo:"See how it works",priceLine:"Free trial throughout 2026.",nav:"Page sections",
    sections:[
      {label:"MORE CLIENTS",h:"Their next tattoo can lead them to your studio.",paragraphs:["Some people know what they want but haven’t chosen an artist. Others are still exploring.","InkSimulator lets them discover designs, try tattoos on their own body and find studios by style and location. Your work can become part of the decision before they choose who will tattoo them.","A design, reference or preview gives you a clearer starting point. You can discuss what will work, develop the idea and guide the client towards a booking."],points:[{title:"Through your work",text:"Your designs and gallery show people your style and help them decide whether you’re the right artist for their idea."},{title:"Through your location and styles",text:"Studio search and map discovery help people find relevant artists nearby."},{title:"From an idea to an enquiry",text:"People can explore a tattoo, find your studio and send their idea and preview to start a conversation."}],subhead:"Start with something more concrete than “I’m thinking about a tattoo.”",closing:"A booking calendar helps once someone has chosen you. InkSimulator also helps you get discovered while that choice is still being made.",flow:["Explore a tattoo","Find your studio","Send an enquiry","Agree the next step"],image:"studios",alt:"InkSimulator studio discovery showing a map and studio listings"},
      {label:"HAPPIER CLIENTS",h:"You want them to love the tattoo — including its size and placement.",paragraphs:["A client can love your artwork and still wish they’d chosen a different size or placed it slightly higher.","Give them the opportunity to explore those decisions before the appointment, with time to compare and think.","InkSimulator lets clients preview the design on their own body, adjust its size and placement, and show you what they have in mind."],highlight:"The best time to rethink the size is before it’s permanent.",subhead:"A clearer idea of what they want. A better conversation about what works.",closing:"Help clients feel good about the whole decision, not just the design.",pointBenefits:["The client can explain their preferences visually. You can use your experience to advise on proportions, detail and placement.","That shared understanding helps align expectations before you begin — giving you a stronger foundation for a result they feel happy with."],points:[{title:"For the client",text:"More confidence in how the design looks on their body."},{title:"For the artist",text:"A clearer understanding of what the client expects."},{title:"For the visit",text:"A shared starting point for confirming the final design, size and placement."}],image:"preview",alt:"Actual InkSimulator tattoo preview on a body"},
      {label:"A STRONGER ONLINE PRESENCE",h:"Give your studio another digital front door.",lead:"Make your work easier to discover — without taking on a website rebuild.",paragraphs:["Your work deserves to be easy to find, even if your website hasn’t been updated in years.","Your InkSimulator profile brings your artists, styles, location and work together, with a clear route to an enquiry or booking. It complements your existing website and social channels."],subhead:"When someone asks an AI to find a tattoo artist, give it useful information to work with.",pointBenefits:["Clear information about your styles, location, artists and booking process helps supported AI services assess whether your studio matches what a client wants.","InkSimulator makes that information and the available booking routes accessible without your studio having to build a separate AI integration."],points:[{title:"A dedicated page for your studio",text:"Give potential clients one place to explore your work, understand what you offer and get in touch."},{title:"More opportunities to appear in search",text:"Your public profile gives Google and AI search services another source of information about your studio, its location and its tattoo styles."},{title:"Ready for AI-assisted discovery and booking",text:"InkSimulator provides structured studio information and booking routes designed for supported AI services and agents to use."}],highlight:"Your work. Your studio. More ways to reach your chair.",image:"profile",alt:"Actual InkSimulator studio profile interface"},
      {h:"“Would this look better smaller?” Let them see.",paragraphs:["A design viewed on its own doesn’t show how it will sit on someone’s body.","After calibration, InkSimulator’s 1:1 AR preview displays the design at its intended real-world size. Clients can compare proportions and placements on their own body."],points:[{title:"Compare size",text:"See how a smaller or larger version changes the overall look."},{title:"Explore the placement",text:"Try it higher, lower or at a different angle."},{title:"Share a preferred direction",text:"Bring a preview into the conversation so you can advise on what will work."}],note:"Clients can explore in their own time. You confirm the final dimensions, placement and suitability together in the studio.",highlight:"More clarity before the appointment. Better-informed decisions in the studio.",image:"preview",alt:"InkSimulator AR preview with a design on the body"},
      {h:"Let the first round of “bigger or smaller?” happen before the appointment.",paragraphs:["Trying another size. Moving the stencil. Stepping back to look again.","Those decisions deserve attention. InkSimulator gives clients a way to start exploring them before they arrive, so you have a clearer direction to work from."],points:[{title:"Before the visit",text:"The client explores the design on their body, compares sizes and placements, and shares a preferred direction."},{title:"At the studio",text:"You review what they have in mind, advise on what works and confirm the final stencil together."}],highlight:"Better preparation can mean fewer stencil adjustments and less time starting from scratch.",note:"Use it with clients who discover you through InkSimulator and with clients who already know your studio.",closing:"Give the decision more room before the visit — and the appointment a clearer starting point."},
      {label:"LESS ADMIN",h:"Keep track of the client without tracking down the conversation.",paragraphs:["The reference photo, the latest sketch, the agreed plan and the booking details belong together.","InkSimulator keeps them connected to the client, so you can pick up the conversation without searching through different apps."],points:[{title:"Find the right sketch and the right conversation",text:"Keep enquiries, references, sketch versions and messages in the client thread."},{title:"Arrange appointments with less back-and-forth",text:"Choose the number and length of sessions, then send a booking link. The client selects an available time and pays a deposit in the app."},{title:"Keep your schedule and incoming enquiries in view",text:"Connect Google Calendar to reflect busy times in your availability. Receive new-enquiry notifications by SMS, email or both."}],pointBenefits:["Less searching. Clearer context when you reply.","You set the time needed. The client chooses a slot.","Less manual calendar checking. A clearer way to stay on top of incoming work."],highlight:"One client. One conversation. A clearer workflow.",image:"bookings",alt:"Actual InkSimulator studio booking dashboard"},
      {label:"LESS MANUAL BOOKKEEPING",h:"Stop entering the same payment twice.",paragraphs:["Save time on bookkeeping — and reduce the work you or your accountant have to handle.","Taking a payment shouldn’t create another task to finish after your last appointment.","Connect your Fortnox account so supported deposits, tattoo payments and design sales are transferred into your bookkeeping automatically. InkSimulator’s fee is recorded as a cost through the integration."],points:[{title:"Save your own time",text:"Reduce manual payment entries and free up time for clients, your work or the end of your day."},{title:"Reduce work for your accountant",text:"Automatic entries can reduce transaction processing work. If you pay for that work by the hour, less manual handling may also reduce your bookkeeping costs."},{title:"Keep payments and fees accounted for",text:"Supported transactions and platform fees are transferred through the integration, making them easier to review and follow up."}],highlight:"Less manual entry. Less processing time. Potential savings on bookkeeping.",closing:"InkSimulator payment → Fortnox bookkeeping entry",note:"The Fortnox integration is included. A separate Fortnox subscription is required. Your bookkeeping still needs the usual review and reconciliation."},
      {h:"You decide the sessions. Your client picks a time.",paragraphs:["Keep control of your work while making the next step straightforward for the client.","1. Review the idea","Discuss the design and what the client wants.","2. Set the appointment requirements","Choose how many sessions are needed and how long each one should be.","3. Send the booking link","The client chooses an available time and pays the deposit through the booking flow."],subhead:"Three ways clients can work with you",points:[{title:"Tattoo bookings",text:"Move from an enquiry to an appointment."},{title:"Custom design requests",text:"Receive ideas and develop sketches with the client."},{title:"Design sales (Pilot)",text:"Make your artwork available to buy through the marketplace."}],image:"designs",alt:"InkSimulator studio design dashboard"},
    ],
    proof:{h:"See how it fits a working studio.",steps:["A client explores size and placement.","The client discovers a studio.","An enquiry arrives with their idea.","The studio handles the conversation and booking."]},
    price:{h:"What’s included. What it costs. How to start.",monthly:"Free trial throughout 2026",yearly:"",fee:"No fixed studio fee or commission during the 2026 trial.",groups:[{title:"Get discovered in more places",text:"Studio and artist profiles, gallery, marketplace presence (Pilot) and public information accessible to search engines and AI services."},{title:"Help clients choose with confidence",text:"AR try-on for exploring size and placement, custom design enquiries, references and sketches."},{title:"Keep appointments organised",text:"Client conversations, session scheduling, booking links, deposits, Google Calendar and team management."},{title:"Reduce manual administration",text:"Studio notifications and Fortnox integration for supported transactions."}],start:"You tattoo. We’ll help with the setup.",startText:"We help you create your studio account, add your artists and work, and configure your booking availability.",noTech:"You don’t need technical knowledge to get started.",contactHelp:"Contact us and we’ll help you get your studio set up.",extra:"Also included: Posture Pro for your studio.",note:"Prices in SEK. Check full terms, including VAT, on the pricing page or when you contact us."},
    faqTitle:"Frequently asked questions",faq:[
      {q:"How can new clients find my studio?",a:"Through your studio profile, work, location and tattoo styles on InkSimulator. Your public profile also gives search engines and AI services information they can use to discover and describe your studio."},
      {q:"Do I need to replace my website?",a:"No. InkSimulator adds another way for people to find your work and contact you. It complements your existing website and social channels."},
      {q:"Can AI agents book with my studio?",a:"Yes. When the agent is enabled for an approved studio, clients can find times and submit a booking through the studio's agent. They confirm their details and that they are at least 18. The booking is either confirmed immediately or awaits studio approval, depending on your settings. Other AI services can link to your booking page, but may not be able to complete the booking themselves."},
      {q:"Can I use InkSimulator with my existing clients?",a:"Yes. They can explore size and placement before their visit and share a preview to help you discuss what they want."},
      {q:"How can this help clients feel happier with their tattoo?",a:"It gives clients time to explore how the design looks on their body and discuss their preferences with you. That helps align expectations about size and placement before you begin."},
      {q:"How does 1:1 sizing work?",a:"The AR experience uses calibration to display the design at its intended real-world size. Clients follow the calibration instructions in the app, and you confirm the final dimensions in person."},
      {q:"Does the preview replace stencil placement?",a:"No. It helps clients explore their preferences beforehand. You confirm the final size, placement and suitability in the studio."},
      {q:"Can clients upload their own designs?",a:"Yes. They can upload and preview a design, then discuss suitability and any changes with you."},
      {q:"Do I control appointment length?",a:"Yes. You choose the number of sessions and their duration before sending the booking link."},
      {q:"Can multiple artists use the platform?",a:"Yes. You can add artists and manage team access within your studio."},
      {q:"Does it connect to Google Calendar?",a:"Yes. Connect Google Calendar so existing busy times are reflected in booking availability."},
      {q:"Can Fortnox integration reduce our bookkeeping costs?",a:"It reduces manual entry for supported platform transactions. That saves processing time and may reduce costs if you pay an accountant for that work. Actual savings depend on your transaction volume and accounting arrangement."},
      {q:"Is Fortnox included in the price?",a:"The integration is included. Your Fortnox subscription is purchased separately."},
      {q:"What does InkSimulator cost?",a:"Free trial throughout 2026 with no fixed studio fee or commission."},
    ],closing:"Help them find you. Help them feel sure. Make more time for tattooing.",closingText:"Give clients more ways to discover your studio. Help them prepare for a tattoo they’ll feel happy with. Keep the conversations, bookings and bookkeeping easier to manage.",login:"Already connected? Studio login",guide:"Read the step-by-step guide",priceLink:"See full pricing and terms",top:"Back to top",contactNote:"This button starts a phone call so we can help you get started.",visualCaption:"Help clients see what feels right before it becomes permanent.",closingBenefits:"More clients. Happier clients. Less admin.",closingHelp:"We’ll help you get started.",product:"InkSimulator is a tattoo discovery, AR try-on and studio management platform. Clients can explore tattoo size and placement on their own body, find studios and send enquiries. Studios can manage conversations, sketches, bookings and deposits, with Fortnox integration for supported payment transactions." },
};

const email = "fredrik@inksimulator.com";
const guideCopy: Record<Lang, { h1: string; flowLabel: string; flow: string[]; topics: string; more: string; less: string; manual: string; call: string; mail: string; themes: { title: string; scope: string }[]; priceNav: string; faqNav: string }> = {
  sv: {
    h1: "Så fungerar InkSimulator i din studio", flowLabel: "Flödet i korthet",
    flow: ["Kunden skickar sin idé", "Ni diskuterar motivet", "Kunden väljer tid", "Studion hanterar besöket"],
    topics: "Innehåll", more: "Läs mer", less: "Visa mindre", manual: "Läs steg-för-steg-guiden", call: "Ring oss", mail: "Mejla oss",
    themes: [
      { title: "Få förfrågningar", scope: "Profil, artister, galleri, synlighet och leads." },
      { title: "Förbered tatueringen", scope: "AR, storlek, placering, referenser, skisser och stencil." },
      { title: "Planera och boka", scope: "Konversationer, sittningar, kalender, deposition och aviseringar." },
      { title: "Administrera studion", scope: "Team, Fortnox, betalningar och övriga verktyg." },
    ], priceNav: "Pris & start", faqNav: "Vanliga frågor",
  },
  en: {
    h1: "How InkSimulator works in your studio", flowLabel: "The flow in brief",
    flow: ["The client sends their idea", "You discuss the design", "The client picks a time", "The studio handles the visit"],
    topics: "Contents", more: "Read more", less: "Show less", manual: "Read the step-by-step guide", call: "Call us", mail: "Email us",
    themes: [
      { title: "Get enquiries", scope: "Profile, artists, gallery, visibility and leads." },
      { title: "Prepare the tattoo", scope: "AR, size, placement, references, sketches and stencil." },
      { title: "Plan and book", scope: "Conversations, sessions, calendar, deposit and notifications." },
      { title: "Run the studio", scope: "Team, Fortnox, payments and other tools." },
    ], priceNav: "Pricing & setup", faqNav: "FAQ",
  },
};
/** Which original sections (by index) live under each theme; their old ids stay as anchors. */
const themeSections = [[0, 2], [1, 3, 4], [5, 7], [6]];
const themeImage: (Picture | undefined)[] = ["studios", "preview", "bookings", undefined];

function DeepBlock({ s, i }: { s: Block; i: number }) {
  return <div id={`section-${i}`} className="scroll-mt-24 border-t border-border pt-6">
    <h4 className="text-lg font-bold leading-snug">{s.h}</h4>
    <div className="mt-3 space-y-3 text-muted-foreground">
      {s.lead && <p className="font-semibold text-foreground">{s.lead}</p>}
      {s.paragraphs.map((p, idx) => i === 7 && idx > 0 && idx % 2 === 1 ? <h5 key={p} className="font-bold text-foreground">{p}</h5> : <p key={p}>{p}</p>)}
    </div>
    {s.subhead && <h5 className="mt-6 font-bold">{s.subhead}</h5>}
    {s.subhead && s.pointBenefits && i !== 5 && <div className="mt-3 space-y-3 text-muted-foreground">{s.pointBenefits.map(p => <p key={p}>{p}</p>)}</div>}
    {s.points && <div className="mt-6 grid gap-5 sm:grid-cols-2">{s.points.map((point, idx) => <div key={point.title}><h5 className="font-bold">{point.title}</h5><p className="mt-1 text-sm text-muted-foreground">{point.text}</p>{i === 5 && s.pointBenefits?.[idx] && <p className="mt-2 text-sm font-semibold text-primary">{s.pointBenefits[idx]}</p>}</div>)}</div>}
    {s.flow && <ol className="mt-6 flex flex-wrap gap-2 text-xs font-bold">{s.flow.map((step, idx) => <li key={step} className="rounded-lg border border-border px-3 py-2">{idx + 1}. {step}</li>)}</ol>}
    {s.highlight && <p className="mt-6 border-l-2 border-primary pl-4 font-bold">{s.highlight}</p>}
    {s.note && <p className="mt-4 text-xs text-muted-foreground">{s.note}</p>}
    {s.closing && <p className="mt-4 font-semibold">{s.closing}</p>}
    {s.image && (s.image === "profile" || s.image === "designs") && <figure className="mt-6"><img src={pictures[s.image]} alt={s.alt || "InkSimulator"} loading="lazy" className="max-h-[420px] w-full rounded-2xl border border-border bg-background object-contain" /></figure>}
  </div>;
}

export function ForStudiosFeaturesPage({ lang }: { lang: Lang }) {
  const t = content[lang];
  const g = guideCopy[lang];
  const sv = lang === "sv";
  const [theme] = useStudioTheme();
  const navigate = useNavigate();
  const localeChecked = useRef(false);
  useEffect(() => { document.documentElement.lang = lang; return () => { document.documentElement.lang = "en"; }; }, [lang]);
  useEffect(() => {
    if (lang !== "en" || localeChecked.current) return;
    localeChecked.current = true;
    let saved: string | null = null;
    try { saved = localStorage.getItem(languageKey); } catch { /* storage unavailable */ }
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
    if (saved === "sv" || (!saved && locales.some(locale => locale.toLowerCase().startsWith("sv")))) {
      void navigate({ to: "/sv/studio-guide", replace: true });
    }
  }, [lang, navigate]);
  // Old section links (#section-0 … #section-7) point into collapsed "Read more" panels: open and scroll.
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      const panel = target.closest("details");
      if (panel && !panel.open) panel.open = true;
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  const choose = (next: Lang) => {
    try { localStorage.setItem(languageKey, next); } catch { /* storage unavailable */ }
    void navigate({ to: next === "sv" ? "/sv/studio-guide" : "/studio-guide" });
  };
  const interestPath = sv ? "/sv/for-studios/interest" : "/for-studios/interest";
  const setupPath = sv ? "/sv/studio-guide/setup" : "/studio-guide/setup";
  const nav = [...g.themes.map((th, i) => ({ id: `theme-${i + 1}`, label: `${i + 1}. ${th.title}` })), { id: "pricing", label: g.priceNav }, { id: "faq", label: g.faqNav }];
  const themeBenefit = [t.benefits[0].text, t.benefits[1].text, t.benefits[2].text, t.price.groups[3].text];

  return <main id="top" className={`studio-guide studio-studios-page studio-visual-profile ${theme === "bright" ? "studio-bright" : ""} min-h-screen bg-background font-mono text-foreground`} lang={lang}>
    <StudioTrackHeader lang={lang} onLang={choose} theme back={{ to: sv ? "/sv/for-studios" : "/for-studios", label: sv ? "Tillbaka till översikten" : "Back to overview" }} />
    <div className="mx-auto w-full max-w-7xl px-5 md:px-10">
      <section className="pb-10 pt-10 lg:pt-16">
        <p className="mb-4 text-xs uppercase tracking-widest text-primary">{t.eyebrow}</p>
        <h1 className="studio-guide-hero max-w-[22ch] font-display text-4xl uppercase leading-[1.05] sm:text-5xl lg:text-6xl">{g.h1}</h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed">{t.sub}</p>
        <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-muted-foreground">{t.intro.map(p => <p key={p}>{p}</p>)}</div>
        <div id="how-it-works" className="scroll-mt-24 mt-8">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">{g.flowLabel}</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{g.flow.map((step, i) => <li key={step} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm"><span className="font-display text-2xl leading-none text-primary">{i + 1}</span><span className="min-w-0">{step}</span>{i < g.flow.length - 1 && <ArrowRight aria-hidden className="ml-auto hidden size-4 shrink-0 text-muted-foreground lg:block" />}</li>)}</ol>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link to={interestPath} className="btn-primary justify-between sm:min-w-64">{t.cta}<ArrowUpRight aria-hidden className="size-4 shrink-0" /></Link>
          <Link to={setupPath} className="btn-secondary justify-between sm:min-w-64">{g.manual}<ArrowRight aria-hidden className="size-4 shrink-0" /></Link>
        </div>
      </section>

      <details className="sticky top-0 z-30 -mx-5 mb-6 border-y border-border bg-background/95 px-5 backdrop-blur lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm">{g.topics}<ChevronDown aria-hidden className="size-4" /></summary>
        <ol className="pb-3">{nav.map(n => <li key={n.id}><a href={`#${n.id}`} onClick={e => (e.currentTarget.closest("details") as HTMLDetailsElement).open = false} className="flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">{n.label}</a></li>)}</ol>
      </details>

      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={t.nav} className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{g.topics}</p>
            <ol className="space-y-1 border-l border-border">{nav.map(n => <li key={n.id}><a href={`#${n.id}`} className="-ml-px block border-l border-transparent py-2 pl-4 text-sm text-muted-foreground hover:border-primary hover:text-foreground">{n.label}</a></li>)}</ol>
            <Link to={setupPath} className="btn-link mt-6 inline-block text-sm">{g.manual}</Link>
            <Link to={interestPath} className="btn-primary mt-5 w-full justify-between">{t.cta}<ArrowUpRight aria-hidden className="size-4 shrink-0" /></Link>
          </div>
        </nav>

        <div className="min-w-0 max-w-3xl pb-24">
          {g.themes.map((th, ti) => <section key={th.title} id={`theme-${ti + 1}`} aria-labelledby={`theme-${ti + 1}-h`} className="scroll-mt-24 border-t border-border py-10 first:border-t-0 first:pt-0">
            <p className="flex items-baseline gap-3"><Num i={ti} small /><span className="text-xs uppercase tracking-widest text-primary">{th.scope}</span></p>
            <h2 id={`theme-${ti + 1}-h`} className="mt-3 font-display text-3xl uppercase leading-tight sm:text-4xl">{th.title}</h2>
            <p className="mt-4 leading-relaxed">{themeBenefit[ti]}</p>
            {themeImage[ti] && <figure className="mt-6"><img src={pictures[themeImage[ti]!]} alt={t.sections[themeSections[ti][0]].alt || "InkSimulator"} loading="lazy" className="max-h-[420px] w-full rounded-3xl border border-border bg-background object-contain" /></figure>}
            <details className="group mt-6">
              <summary className="btn-secondary w-fit cursor-pointer list-none gap-2"><span className="group-open:hidden">{g.more}</span><span className="hidden group-open:inline">{g.less}</span><ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" /></summary>
              <div className="mt-6 space-y-8">{themeSections[ti].map(i => <DeepBlock key={i} s={t.sections[i]} i={i} />)}</div>
            </details>
          </section>)}

          <section id="pricing" className="scroll-mt-24 border-t border-border py-10">
            <h2 className="font-display text-3xl uppercase leading-tight sm:text-4xl">{t.price.h}</h2>
            <div className="mt-6 rounded-3xl border border-border bg-card p-6">
              <p className="font-display text-4xl uppercase text-primary">{t.price.monthly}</p>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">{t.price.groups.map(gr => <div key={gr.title} className="border-t border-border pt-4"><h3 className="font-bold">{gr.title}</h3><p className="mt-2 text-sm text-muted-foreground">{gr.text}</p></div>)}</div>
            <div className="mt-10 border-t border-border pt-8">
              <h3 className="font-display text-2xl uppercase">{t.price.start}</h3>
              <p className="mt-3 text-muted-foreground">{t.price.startText}</p>
              <p className="mt-3 text-muted-foreground">{t.price.noTech}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link to={interestPath} className="btn-primary justify-between sm:min-w-64">{t.cta}<ArrowUpRight aria-hidden className="size-4 shrink-0" /></Link>
                <a href={contact} className="btn-link inline-flex items-center gap-2"><Phone aria-hidden className="size-4" />{g.call}</a>
                <a href={`mailto:${email}`} className="btn-link inline-flex items-center gap-2"><Mail aria-hidden className="size-4" />{g.mail}</a>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t.price.contactHelp}</p>
            </div>
          </section>

          <section id="faq" className="scroll-mt-24 border-t border-border py-10">
            <h2 className="font-display text-3xl uppercase sm:text-4xl">{t.faqTitle}</h2>
            <div className="mt-6 divide-y divide-border border-y border-border">{t.faq.map((item, index) => <details key={item.q} className="group py-5"><summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{item.q}<ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" /></summary><p className="pt-3 text-sm text-muted-foreground">{item.a}{index === 13 && <> <Link to="/pricing" className="underline underline-offset-2">{t.priceLink}</Link></>}</p></details>)}</div>
            <a href="#top" className="btn-link mt-8 inline-flex items-center gap-2 text-sm"><ArrowUp aria-hidden className="size-4" />{t.top}</a>
          </section>
        </div>
      </div>
    </div>
  </main>;
}
