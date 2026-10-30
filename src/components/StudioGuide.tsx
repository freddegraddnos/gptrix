/**
 * Studio tutorial: a plain walkthrough of every tool in the studio panel and
 * what to do with it. Each step can jump straight to the matching tab.
 * Follows the studio language switch (Swedish / English).
 */
import { t, useStudioLang, type Copy } from "@/lib/studioLang";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { StudioTab } from "@/lib/studioNav";

type Step = {
  tab: StudioTab;
  n: number;
  title: Copy;
  what: Copy;
  how: Copy;
  first?: boolean;
};

const STEPS: Step[] = [
  {
    tab: "profil",
    n: 1,
    title: { en: "Your studio profile", sv: "Din studioprofil" },
    what: {
      en: "Name, city, address, logo, bio, Instagram and website — this is what customers see when they find you.",
      sv: "Namn, stad, adress, logotyp, presentation, Instagram och webbplats — det här ser kunden när de hittar dig.",
    },
    how: {
      en: "Fill in every field and save. The logo and bio are what make people tap your studio instead of scrolling past.",
      sv: "Fyll i alla fält och spara. Logotypen och presentationen är det som får folk att trycka på din studio i stället för att scrolla förbi.",
    },
    first: true,
  },
  {
    tab: "gallery",
    n: 2,
    title: { en: "Gallery", sv: "Galleri" },
    what: { en: "Photos of your work and your studio.", sv: "Bilder på ditt arbete och din studio." },
    how: {
      en: "Upload 6–12 of your best healed tattoos. They show on your public profile and in search results.",
      sv: "Ladda upp 6–12 av dina bästa läkta tatueringar. De visas på din publika profil och i sökresultaten.",
    },
    first: true,
  },
  {
    tab: "hours",
    n: 3,
    title: { en: "Opening hours & availability", sv: "Öppettider & tillgänglighet" },
    what: {
      en: "The hours customers can request, and the days you are closed.",
      sv: "Tiderna kunder kan boka, och dagarna du håller stängt.",
    },
    how: {
      en: "Set your normal week once. Block holidays as they come up so nobody books a closed day.",
      sv: "Ställ in din vanliga vecka en gång. Blockera lediga dagar efter hand så ingen bokar en stängd dag.",
    },
    first: true,
  },
  {
    tab: "kalender",
    n: 4,
    title: { en: "Calendar & sessions", sv: "Kalender & sessioner" },
    what: {
      en: "Bookable slots, session length and how many sessions a piece needs.",
      sv: "Bokningsbara tider, sessionslängd och hur många sessioner en tatuering behöver.",
    },
    how: {
      en: "Connect Google Calendar and busy times are blocked automatically. Send a booking link and the customer picks a free slot.",
      sv: "Koppla Google Kalender så blockeras upptagna tider automatiskt. Skicka en bokningslänk så väljer kunden en ledig tid.",
    },
    first: true,
  },
  {
    tab: "tjanster",
    n: 5,
    title: { en: "Services & prices", sv: "Tjänster & priser" },
    what: {
      en: "What you offer and what it costs — hourly rate, minimum charge, consultation.",
      sv: "Vad du erbjuder och vad det kostar — timpris, minimidebitering, konsultation.",
    },
    how: {
      en: "Add each service with a price. Customers see it before they ask, so you get fewer 'what does it cost' messages.",
      sv: "Lägg in varje tjänst med pris. Kunden ser det innan de frågar, så du får färre ”vad kostar det”-meddelanden.",
    },
  },
  {
    tab: "bokningar",
    n: 6,
    title: { en: "Bookings & requests", sv: "Bokningar & förfrågningar" },
    what: {
      en: "Incoming requests with the customer's design, exact size in mm and placement on the body.",
      sv: "Inkomna förfrågningar med kundens motiv, exakt storlek i mm och placering på kroppen.",
    },
    how: {
      en: "Open a request, agree on a time, take a deposit and confirm. Everything stays in one thread.",
      sv: "Öppna en förfrågan, kom överens om en tid, ta en handpenning och bekräfta. Allt samlas i samma tråd.",
    },
  },
  {
    tab: "notifs",
    n: 7,
    title: { en: "SMS notifications", sv: "SMS-aviseringar" },
    what: {
      en: "Get a text from \"InkSimulator\" for every new request, with a direct link to it.",
      sv: "Få ett SMS från \"InkSimulator\" vid varje ny förfrågan, med en direktlänk till den.",
    },
    how: {
      en: "Settings → Notification settings → choose Email, SMS or both → enter your mobile number (+46…) → Save. The test button is available there when you explicitly want to use it.",
      sv: "Inställningar → Aviseringsinställningar → välj E-post, SMS eller båda → skriv mobilnummer (+46…) → Spara. Testknappen finns där när du uttryckligen vill använda den.",
    },
  },
  {
    tab: "sales",
    n: 8,
    title: { en: "Payments, deposits & Fortnox", sv: "Betalningar, handpenning & Fortnox" },
    what: {
      en: "Deposits, final payments, design sales and your payout balance.",
      sv: "Handpenningar, slutbetalningar, motivförsäljning och ditt utbetalningssaldo.",
    },
    how: {
      en: "Customers pay by card in the app. Send each paid sale to Fortnox with one button. Free trial throughout 2026 with no fixed studio fee or commission.",
      sv: "Kunden betalar med kort i appen. Skicka varje betald försäljning till Fortnox med en knapp. Gratis provperiod under hela 2026 utan fast studioavgift eller provision.",
    },
  },
  {
    tab: "motiv",
    n: 9,
    title: { en: "Your designs (flash)", sv: "Dina motiv (flash)" },
    what: {
      en: "Flash designs customers can try on in AR and buy.",
      sv: "Flashmotiv som kunder kan prova i AR och köpa.",
    },
    how: {
      en: "Upload clean designs on a white background — InkSimulator removes the background. These are public in the shop. To send a design to one customer only, use \"Send a private design\" below.",
      sv: "Ladda upp rena motiv på vit bakgrund — InkSimulator tar bort bakgrunden. Dessa blir publika i shoppen. Vill du skicka ett motiv till bara en kund, använd \"Skicka ett privat motiv\" nedan.",
    },
  },
  {
    tab: "scans",
    n: 10,
    title: { en: "3D scans", sv: "3D-skanningar" },
    what: {
      en: "Body scans customers send in before they arrive.",
      sv: "Kroppsskanningar som kunder skickar in innan de kommer.",
    },
    how: {
      en: "Open the scan to see the exact shape of the arm or leg, so the stencil fits before the customer sits down.",
      sv: "Öppna skanningen för att se exakt form på arm eller ben, så att stencilen passar innan kunden sätter sig.",
    },
  },
  {
    tab: "team",
    n: 11,
    title: { en: "Artists in the studio", sv: "Tatuerare i studion" },
    what: { en: "The artists who work with you.", sv: "Tatuerarna som jobbar hos dig." },
    how: {
      en: "Add each artist with a photo and their styles so customers can pick the right person.",
      sv: "Lägg till varje tatuerare med bild och stilar så kunden kan välja rätt person.",
    },
  },
  {
    tab: "deals",
    n: 12,
    title: { en: "Offers", sv: "Erbjudanden" },
    what: { en: "Campaigns and last-minute slots.", sv: "Kampanjer och sista minuten-tider." },
    how: {
      en: "Post an offer when you have a gap in the calendar — it shows in the app's community feed.",
      sv: "Lägg upp ett erbjudande när du har en lucka i kalendern — det visas i appens community-flöde.",
    },
  },
  {
    tab: "members",
    n: 13,
    title: { en: "Customers", sv: "Kunder" },
    what: {
      en: "Your customer list with history and notes.",
      sv: "Din kundlista med historik och anteckningar.",
    },
    how: {
      en: "Open a customer to see past sessions, sent designs and messages before their next visit.",
      sv: "Öppna en kund för att se tidigare sessioner, skickade motiv och meddelanden inför nästa besök.",
    },
  },
  {
    tab: "skisser",
    n: 14,
    title: { en: "Send a private design to a customer", sv: "Skicka ett privat motiv till en kund" },
    what: {
      en: "A design only you and that customer can see — it never appears in the public shop.",
      sv: "Ett motiv som bara du och kunden ser — det hamnar aldrig i den publika shoppen.",
    },
    how: {
      en: "Open Requests → pick the customer → upload your sketch. The customer can comment, try it in AR and approve it.",
      sv: "Öppna Förfrågningar → välj kunden → ladda upp din skiss. Kunden kan kommentera, prova i AR och godkänna den.",
    },
  },
];

const copy = {
  heading: { en: "How InkSimulator works for your studio", sv: "Så fungerar InkSimulator för din studio" },
  intro: {
    en: "Customers try your designs on their own skin in AR, see the exact size and placement, and send you a request with all of it attached. You reply, take a deposit and book the time — in one place.",
    sv: "Kunder provar dina motiv på sin egen hud i AR, ser exakt storlek och placering och skickar dig en förfrågan med allt bifogat. Du svarar, tar en handpenning och bokar tiden — på ett och samma ställe.",
  },
  firstLead: { en: "New here? Do these four first:", sv: "Ny här? Gör de här fyra först:" },
  open: { en: "Open", sv: "Öppna" },
  helpTitle: { en: "Need a hand?", sv: "Behöver du hjälp?" },
  or: { en: "Call", sv: "Ring" },
  guideLead: {
    en: "There is also a full written guide at",
    sv: "Det finns också en komplett skriftlig guide på",
  },
} satisfies Record<string, Copy>;

export function StudioGuide({ onOpenTab }: { onOpenTab: (tab: StudioTab, step: number) => void }) {
  const [lang] = useStudioLang();
  const setup: { number: number; tab: StudioTab; title: Copy; needed: Copy; optional: Copy }[] = [
    { number: 1, tab: "profil", title: { en: "Studio identity & address", sv: "Studiouppgifter & adress" }, needed: { en: "Name, city, contact email and your InkSimulator address.", sv: "Namn, stad, kontaktmejl och din InkSimulator-adress." }, optional: { en: "Bio, Instagram and website can be added later.", sv: "Presentation, Instagram och webbplats kan läggas till senare." } },
    { number: 2, tab: "profil", title: { en: "Your customer page", sv: "Din kundsida" }, needed: { en: "Choose the page layout in Profile & look, then check Customer view.", sv: "Välj sidans utseende i Profil & utseende och kontrollera sedan Kundvy." }, optional: { en: "Logo, cover, background image and gallery photos make it personal.", sv: "Logotyp, omslag, bakgrundsbild och galleribilder gör den personlig." } },
    { number: 3, tab: "hours", title: { en: "When customers can book", sv: "När kunder kan boka" }, needed: { en: "Set availability and publish the times you can take appointments.", sv: "Ange tillgänglighet och lägg ut tider då du kan ta bokningar." }, optional: { en: "Connecting your calendar is optional.", sv: "Kalenderkoppling är valfri." } },
    { number: 4, tab: "tjanster", title: { en: "Services & booking details", sv: "Tjänster & bokningsuppgifter" }, needed: { en: "Add the services and prices customers need to choose from.", sv: "Lägg in de tjänster och priser kunden behöver välja mellan." }, optional: { en: "A booking agent and automatic estimates are optional.", sv: "Bokningsagent och automatiska prisförslag är valfria." } },
    { number: 5, tab: "profil", title: { en: "Review & submit", sv: "Granska & skicka in" }, needed: { en: "Open Customer view and check your studio page before sharing it.", sv: "Öppna Kundvy och kontrollera studiosidan innan du delar den." }, optional: { en: "You can keep refining photos and designs afterward.", sv: "Du kan fortsätta förbättra bilder och motiv efteråt." } },
  ];
  return (
    <div className="space-y-7">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-bold uppercase text-accent">{lang === "sv" ? "Kom igång" : "Set up your studio"}</p>
        <h2 className="studio-heading mt-2 font-display text-3xl uppercase">{lang === "sv" ? "Från konto till kundsida" : "From account to customer page"}</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t(copy.intro, lang)}</p>
      </header>
      <ol className="divide-y divide-border border-y border-border">{setup.map((s, i) => <li id={`guide-step-${15 + i}`} key={s.number} className="scroll-mt-36 grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
        <span className="grid size-8 place-items-center rounded-full border border-accent font-bold text-accent">{s.number}</span>
        <div className="min-w-0"><h3 className="font-display text-xl uppercase">{t(s.title, lang)}</h3><p className="mt-1 text-sm">{t(s.needed, lang)}</p><p className="mt-1 text-xs text-muted-foreground">{t(s.optional, lang)}</p></div>
        <Button type="button" variant="outline" onClick={() => onOpenTab(s.tab, 15 + i)} className="col-start-2 w-fit gap-2 sm:col-start-3">{t(copy.open, lang)}<ArrowRight className="size-4" /></Button>
      </li>)}</ol>
      <h2 className="studio-heading font-display text-2xl uppercase">{lang === "sv" ? "Alla verktyg" : "All tools"}</h2>

      {STEPS.map((s) => (
        <section
          key={s.n}
          id={`guide-step-${s.n}`}
          className="scroll-mt-36 border-b border-border py-5"
        >
          <h3 className="font-display text-xl uppercase">{s.n} · {t(s.title, lang)}</h3>
          <p className="mt-1 text-[13px] leading-snug text-foreground/85">{t(s.what, lang)}</p>
          <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{t(s.how, lang)}</p>
          <Button
            type="button"
            onClick={() => onOpenTab(s.tab, s.n)}
            variant="outline" size="sm" className="mt-3"
          >
            {t(copy.open, lang)}<ArrowRight className="size-4" />
          </Button>
        </section>
      ))}

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-[15px] font-bold">{t(copy.helpTitle, lang)}</h3>
        <p className="mt-1 text-[13px] leading-snug text-foreground/85">
          {t(copy.or, lang)}{" "}
          <a className="text-accent underline" href="tel:+46793288098">
            +46 79 328 80 98
          </a>
          . {t(copy.guideLead, lang)}{" "}
          <a className="text-accent underline" href="/for-studios">
            inksimulator.com/for-studios
          </a>
          .
        </p>
      </section>
    </div>
  );
}
