import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft, ArrowRight, ArrowUp, Bell, BookOpenCheck, CalendarDays, ChevronDown, Clock, Globe,
  HeartPulse, Image as ImageIcon, KeyRound, LogIn, Phone, MessageCircle, Palette, ScanLine,
  ShieldCheck, Sparkles, Tag, TrendingUp, Users,
} from "lucide-react";
import { usePublicStudioLang } from "@/lib/publicStudioLang";
import { useStudioTheme } from "@/lib/studioTheme";
import { StudioTrackHeader } from "@/components/StudioTrackHeader";

import imgCommunity from "@/assets/guide/community-studios.png";
import imgAdminSignup from "@/assets/guide/adminsignup-form.png";
import imgSetPassword from "@/assets/guide/set-password-filled.png";
import imgDashProfile from "@/assets/guide/dashboard-profile.png";
import imgDashGallery from "@/assets/guide/dashboard-gallery.png";
import imgDashHours from "@/assets/guide/dashboard-hours.png";
import imgDashBookings from "@/assets/guide/dashboard-bookings.png";
import imgDashDesigns from "@/assets/guide/dashboard-designs.png";
import imgCameraPrimer from "@/assets/guide/ar-camera-primer.png";
import imgArPreview from "@/assets/guide/ar-preview.png";

type Shot = { alt: string; caption: string };
type Feat = { icon: string; t: string; d: string };

/* Typography — Anton for display, DM Mono for everything else. */
const DISPLAY = "font-display font-normal uppercase";
const MONO = "font-mono";

const ICONS: Record<string, typeof Palette> = {
  palette: Palette, sparkles: Sparkles, calendar: CalendarDays, chat: MessageCircle,
  scan: ScanLine, image: ImageIcon, users: Users, clock: Clock, tag: Tag, bell: Bell,
  book: BookOpenCheck, pulse: HeartPulse, globe: TrendingUp,
};

const T = {
  sv: {
    brand: "InkSimulator", langBtn: "English", langAria: "Switch to English", navAria: "Avsnitt i guiden",
    back: "Till artistsidan", faqH: "Vanliga frågor", overview: "I den här guiden", top: "Till toppen",
    pricingLink: "Se priser och provperiod",
    nav: [
      { id: "why", label: "Varför", summary: "Så hjälper AR-provning din studio att nå kunder." },
      { id: "journey", label: "Kundflöde", summary: "Från första provning till bokad tid." },
      { id: "features", label: "Funktioner", summary: "En överblick av verktygen i artistpanelen." },
      { id: "start", label: "Kom igång", summary: "Få ditt konto och logga in första gången." },
      { id: "profile", label: "Profil", summary: "Visa upp studion, teamet och verifiering." },
      { id: "designs", label: "Motiv", summary: "Hantera motiv, galleri och erbjudanden." },
      { id: "bookings", label: "Bokningar", summary: "Styr tider, kalender och kundförfrågningar." },
      { id: "cost", label: "Kostnad & FAQ", summary: "Se priser och svar på vanliga frågor." },
    ],
    hero: {
      kicker: "Studioguide", titleA: "InkSimulator för", titleB: "studios",
      sub: "Vi har 100-tals kunder varje vecka som: provar motiv i AR i skala 1:1 — och skickar motiv, bokningsförfrågningar och betalningar direkt till din studio. Allt du behöver veta, klick för klick.",
      contact: "Anmäl intresse", login: "Logga in i panelen",
       shot: { alt: "Illustration av tatuering på armen och lila AR-vy på en telefon", caption: "AR-inspiration" },
    },
    included: {
      h: "Ingår i ditt abonnemang",
      lead: "Sex verktyg som sparar tid och pengar — utan extra kostnad.",
      demand: { t: "Kunder som redan provat motivet", tag: "Efterfrågan", d: "Kunder provar motiv i AR i skala 1:1 och skickar sedan förfrågan med bilden direkt till din studio." },
      bookings: { t: "Bokningar, kalender & depositioner", tag: "Allt på ett ställe", d: "Godkänn bokningar med antal sittningar och tidsåtgång, koppla Google Kalender så upptagna tider blockeras och ta emot depositioner i appen." },
      sms: { t: "SMS-aviseringar", tag: "Få kunden direkt", d: "Ny förfrågan? Du får SMS på direkten. Välj e-post, SMS eller båda två, och skicka ett test-SMS så du vet att det funkar. Du missar aldrig en kund — även när panelen är stängd." },
      fortnox: { t: "Fortnox integration — bokföringen sköter sig själv", tag: "Spara tid & pengar", d: "Integration mot Fortnox ingår — själva Fortnox-abonnemanget tecknar du hos Fortnox. Koppla din egen Fortnox med ett tryck: depositioner, tatueringsbetalningar och motivförsäljningar bokförs automatiskt på de konton du väljer, och InkSimulators avgift registreras som kostnad." },
      posture: { t: "Posture Pro ingår", tag: "Värde 999 kr/år", d: "Enligt svensk lag och Arbetsmiljöverket måste du arbeta proaktivt med hälsomiljön på arbetsplatsen. InkSimulator hjälper er med det: Posture Pro ingår i abonnemanget och du loggar in med samma uppgifter som i studiopanelen. Mät din hållning via kameran på iPad eller dator, få förslag på övningar och bli varnad när hållningen varit skadlig en längre tid." },
      seo: { t: "Ranka högre på sökmotorer", tag: "Synlighet & SEO", d: "Du får en egen studioprofil på vår .com-domän med många interna länkar och backlinks. Det kan hjälpa er att ranka högre på sökmotorer som Google och synas för fler som söker tatuerare i er stad. Vi kan inte lova en viss placering — sökmotorerna bestämmer — men en aktiv profil ger er fler vägar in." },
    },
    why: {
      num: "01", h: "Varför InkSimulator?", lead: "Kunder kan se motivet på sin egen kropp innan de hör av sig.",
      points: [
        { t: "Provat innan bokning", d: "Kunder provar dina motiv på sin egen hud i AR, i exakt skala, innan de bokar." },
        { t: "En app, tre intäkter", d: "Designförsäljning, skissprojekt och bokningar i samma app — gratis provperiod under hela 2026." },
        { t: "Hittad via kartan", d: "Kunder hittar dig via karta, avstånd och stilfilter." },
        { t: "Bokföring & aviseringar ingår", d: "Fortnox integration och SMS-aviseringar ingår — bokföringen sköter sig själv och du får varje förfrågan direkt." },
        { t: "Egen profil på vår .com-domän", d: "Studion får en egen profilsida med backlinks, vilket kan hjälpa er att ranka högre på Google och andra sökmotorer." },
        { t: "Partner med märke", d: "Du syns som Partner. Verifierade studios får ett märke som bygger förtroende." },
      ],
    },
    journey: {
      num: "02", h: "Kundflödet — från provning till bokad tid", lead: "Så ser resan ut för en kund som hittar din studio i appen.",
      steps: [
        "Kunden provar motiv i AR — från biblioteket, din marketplace eller en egen skiss.",
        "Motivet låses på huden i skala 1:1 efter kalibrering — kunden ser storleken i centimeter.",
        "Kunden hittar din studio under Utforska → Studios, via karta, avstånd och stil.",
        "Kunden skickar motivet, ett meddelande eller en bokningsförfrågan till din inkorg.",
        "Du svarar med en kalenderlänk, kunden väljer tid och betalar deposition i appen.",
      ],
       shotA: { alt: "InkSimulators aktuella introduktion till livekameran", caption: "Live AR — aktivera kameran" },
      shotB: { alt: "Utforska → Studios med karta och stilfilter", caption: "Utforska → Studios" },
    },
    features: {
      num: "03", h: "Allt du kan göra i artistpanelen", lead: "Panelen är uppdelad i flikar. Här är översikten — detaljerna kommer nedan.",
      items: [
        { icon: "palette", t: "Sälj motiv & designs (Pilot)", d: "Ladda upp motiv till bibliotek och marketplace. Kunder köper i appen, du får betalt per design." },
        { icon: "sparkles", t: "Skissprojekt (custom)", d: "Kunden beskriver idén, du skapar versioner och skickar tillbaka i appen. Vårt skissverktyg är kompatibelt med filformat från ProCreate m.fl." },
        { icon: "calendar", t: "Boka tider", d: "Ange sessioner och minuter, skicka kalenderlänk. Upptagna tider blockeras automatiskt." },
        { icon: "chat", t: "Chatta med kunder", d: "Kunden skickar motiv, frågor och referensbilder direkt till din inkorg i panelen." },
        { icon: "bell", t: "Aviseringar", d: "Få nya förfrågningar via e-post, SMS eller båda två — välj själv i panelen." },
        { icon: "scan", t: "3D-skannade kroppsdelar", d: "Kunden skannar arm eller ben — motivet böjs efter kroppsformen." },
        { icon: "image", t: "Studio-galleri", d: "Visa dina bästa arbeten på din publika profil." },
        { icon: "users", t: "Team & medlemmar", d: "Lägg till tatuerare och styr vem som har åtkomst." },
        { icon: "clock", t: "Öppettider", d: "Sätt öppettider, blockera tider och synka med Google Kalender." },
        { icon: "tag", t: "Erbjudanden & priser", d: "Skapa deals, prissätt motiv och hantera depositioner. Kör en flash-deal på kort varsel när du får avbokningar." },
        { icon: "book", t: "Fortnox integration", d: "Koppla din egen Fortnox — betalningar och motivförsäljningar bokförs automatiskt. Integrationen ingår; Fortnox-abonnemanget tecknar du hos Fortnox." },
        { icon: "globe", t: "Egen profil & SEO", d: "Egen studioprofil på vår .com-domän med backlinks — kan hjälpa er att ranka högre på Google." },
        { icon: "pulse", t: "Posture Pro", d: "Ingår — värde 999 kr/år. Mät hållningen via kameran på iPad eller dator, få övningsförslag och varningar när hållningen varit skadlig en längre tid." },
      ],
    },
    start: {
      num: "04", h: "Kom igång", lead: "Kontot skapas alltid av InkSimulator tillsammans med studion. Därefter tar det några minuter.",
      steps: [
        { t: "Få ditt konto", d: "Vi registrerar studiokontot åt dig och ger dig e-post och ett tillfälligt lösenord." },
        { t: "Logga in första gången", d: "Gå till inksimulator.com/sv/artists → Logga in. Använd e-post och det tillfälliga lösenordet." },
        { t: "Välj eget lösenord", d: "Du måste välja ett eget lösenord (minst 8 tecken). Därefter öppnas panelen." },
        { t: "Glömt lösenordet?", d: "Tryck på ”Glömt lösenordet?” på inloggningssidan — du får en länk via e-post." },
      ],
      note: "Registreringen sköts av InkSimulator och sker aldrig via en publik sida.",
      shotA: { alt: "Registreringsformuläret som InkSimulator fyller i", caption: "Kontot registreras av InkSimulator" },
      shotB: { alt: "Skärmen där du väljer eget lösenord", caption: "Välj eget lösenord" },
    },
    profile: {
      num: "05", h: "Profil, team & verifiering", lead: "En komplett profil hjälper kunder att förstå vad ni erbjuder. Allt görs under Profil & utseende.",
      items: [
        "Studionamn, tagline och beskrivning — berätta om stilar och prisnivå.",
        "Logga — syns i sök, chatt och bokningar. Byt när som helst.",
        "Adress, stad, telefon, webbplats och Instagram — valfritt men rekommenderat.",
        "Position på kartan krävs för att kunder ska hitta dig via ”nära mig”.",
      ],
      team: { t: "Artistpresentationer och åtkomst", d: "Lägg till offentliga artistpresentationer under Artister på studiosidan. Inbjudningar och roller hanteras separat under Team och åtkomst; posterna kopplas inte automatiskt." },
      verify: { t: "Verifiering", d: "Verifierad betyder att kontaktmejlen är bekräftad och företagsdokumentation är registrerad. Det är ingen hygienkontroll. Dokumenten ses bara av InkSimulator." },
      shot: { alt: "Panelen, Profil & utseende", caption: "Panel → Profil & utseende" },
    },
    designs: {
      num: "06", h: "Motiv, galleri & erbjudanden", lead: "Tre flikar för det du vill sälja och visa.",
      tabs: [
        { k: "designs", d: "Ladda upp motiv — sätt titel, kategori (Japanese, Realistic, Blackwork…) och pris. Kunden köper i appen." },
        { k: "gallery", d: "Ladda upp foton på färdiga tatueringar till din publika profil." },
        { k: "deals", d: "Skapa kampanjer och paketpriser." },
      ],
      shotA: { alt: "Panelen, fliken designs", caption: "Panel → designs" },
      shotB: { alt: "Panelen, fliken gallery", caption: "Panel → gallery" },
    },
    bookings: {
      num: "07", h: "Bokningar, kalender & meddelanden", lead: "Full kontroll över din tid — utan dubbelbokningar.",
      tabs: [
        { k: "hours", d: "Sätt öppettider och tillgänglighet per dag." },
        { k: "calendar", d: "Se alla bokningar och blockera tider direkt i panelens kalender." },
        { k: "google kalender", d: "Koppla studions Google-konto med ett klick. Bokningar synkas och upptagna tider blockeras automatiskt, så du slipper dubbelbokningar." },
        { k: "tidsåtgång", d: "När du godkänner en förfrågan väljer du antal sittningar (1–4) och timmar per sittning (1–8). Kalenderlänken kunden får räknar med den tiden." },
        { k: "kalenderlänk", d: "Kunden väljer bland lediga tider, betalar deposition och tiden blockeras." },
        { k: "aviseringar", d: "Välj e-post, SMS eller båda. Lägg in mobilnumret med landskod och skicka ett test-SMS så du vet att det funkar." },
        { k: "requests & chat", d: "Alla förfrågningar samlas i din inkorg — svara direkt i appen." },
      ],
      shotA: { alt: "Panelen, fliken hours", caption: "Panel → hours" },
      shotB: { alt: "Panelen, fliken bookings med kalender", caption: "Panel → bookings" },
    },
    cost: {
      num: "08", h: "Vanliga frågor", lead: "Svar på det studios oftast undrar över.",
      faq: [
        { q: "Kostar det något?", a: "Gratis provperiod under hela 2026 utan fast studioavgift eller provision. Priser anges i SEK." },
        { q: "Ingår Posture Pro?", a: "Ja — värde 999 kr/år, utan extra kostnad. Mät hållningen via kameran på iPad eller dator, få förslag på övningar och bli varnad när hållningen varit skadlig en längre tid. Enligt svensk lag och Arbetsmiljöverket ska du arbeta proaktivt med hälsomiljön på arbetsplatsen." },
        { q: "Kan vi koppla Fortnox?", a: "Ja — Fortnox integration ingår och kopplas med ett tryck i panelen. Själva Fortnox-abonnemanget tecknar ni hos Fortnox. Depositioner, tatueringsbetalningar och motivförsäljningar bokförs automatiskt." },
        { q: "Hjälper ni oss synas på Google?", a: "Ni får en egen studioprofil på vår .com-domän med många backlinks. Det kan hjälpa er att ranka högre på Google och andra sökmotorer — men vi kan inte lova en viss placering, det bestämmer sökmotorerna." },
        { q: "Måste kunden skicka ett foto?", a: "Nej. Kunder kan kontakta studion och skicka en bokningsförfrågan utan foto." },
        { q: "Kan flera tatuerare dela studio?", a: "Ja. Offentliga presentationer hanteras under Artister på studiosidan och användaråtkomst under Team och åtkomst." },
        { q: "Vem ser våra dokument?", a: "Bara InkSimulator. Dokumenten är inte publika." },
      ],
      cta: "Redo att komma igång?", ctaSub: "Kontakta oss så hjälper vi dig att skapa ditt studiokonto.",
    },
    footer: "© InkSimulator · Guide för studios",
  },
  en: {
    brand: "InkSimulator", langBtn: "Svenska", langAria: "Byt till svenska", navAria: "Guide sections",
    back: "Back to artists", faqH: "FAQ", overview: "In this guide", top: "Back to top",
    pricingLink: "See pricing and trial terms",
    nav: [
      { id: "why", label: "Why", summary: "How AR try-on helps your studio reach clients." },
      { id: "journey", label: "Client flow", summary: "From the first try-on to a booked session." },
      { id: "features", label: "Features", summary: "An overview of the artist panel tools." },
      { id: "start", label: "Get started", summary: "Get your account and sign in for the first time." },
      { id: "profile", label: "Profile", summary: "Present your studio, team and verification." },
      { id: "designs", label: "Designs", summary: "Manage designs, gallery and offers." },
      { id: "bookings", label: "Bookings", summary: "Manage availability, calendar and requests." },
      { id: "cost", label: "Cost & FAQ", summary: "See pricing and answers to common questions." },
    ],
    hero: {
      kicker: "Studio guide", titleA: "InkSimulator for", titleB: "tattoo studios",
      sub: "Hundreds of clients every week: they try designs in AR at true 1:1 scale — then send designs, booking requests and payments straight to your studio. Everything you need to know, click by click.",
      contact: "Register your interest", login: "Log in to the panel",
       shot: { alt: "Illustration of an arm tattoo and a purple AR view on a phone", caption: "AR inspiration" },
    },
    included: {
      h: "Included in your plan",
      lead: "Six tools that save you time and money — at no extra cost.",
      demand: { t: "Clients who already tried the design", tag: "Client demand", d: "Clients try designs on their skin in AR at 1:1 scale, then send their request with the preview straight to your studio." },
      bookings: { t: "Bookings, calendar & deposits", tag: "All in one place", d: "Approve bookings with number of sessions and duration, connect Google Calendar so busy times are blocked, and take deposits in the app." },
      sms: { t: "SMS notifications", tag: "Hear it instantly", d: "New request? You get an SMS straight away. Choose email, SMS or both, and send a test SMS to be sure it works. You'll never miss a client — even when the panel is closed." },
      fortnox: { t: "Fortnox integration — bookkeeping done for you", tag: "Save time & money", d: "The Fortnox integration is included — the Fortnox subscription itself you buy from Fortnox. Connect your own Fortnox with one tap: deposits, tattoo payments and design sales are posted automatically to the accounts you choose, and InkSimulator's fee is recorded as a cost." },
      posture: { t: "Posture Pro included", tag: "Worth 999 kr/year", d: "Under Swedish law and the Swedish Work Environment Authority you must work proactively with the health environment at your workplace. InkSimulator helps you do it: Posture Pro is included in your plan and you sign in with the same credentials as the studio panel. Measure your posture with the camera on an iPad or computer, get exercise suggestions and a warning when your posture has been harmful for a longer time." },
      seo: { t: "Rank higher on search engines", tag: "Visibility & SEO", d: "You get your own studio profile on our .com domain with plenty of internal links and backlinks. That can help you rank higher on search engines like Google and be found by more people searching for a tattoo artist in your city. We can't promise a specific position — the search engines decide — but an active profile gives you more ways in." },
    },
    why: {
      num: "01", h: "Why InkSimulator?", lead: "Clients can see the design on their own body before they get in touch.",
      points: [
        { t: "Tried before booking", d: "Clients try your designs on their own skin in AR, at exact scale, before booking." },
        { t: "One app, three revenues", d: "Design sales, custom sketches and bookings in one app — free trial throughout 2026." },
        { t: "Found on the map", d: "Clients find you by map, distance and style filters." },
        { t: "Bookkeeping & alerts included", d: "The Fortnox integration and SMS notifications are included — your books stay up to date and every request reaches you instantly." },
        { t: "Your own profile on our .com domain", d: "Your studio gets its own profile page with backlinks, which can help you rank higher on Google and other search engines." },
        { t: "Partner badge", d: "You appear as a Partner. Verified studios get a trust badge." },
      ],
    },
    journey: {
      num: "02", h: "Client flow — from try-on to booked slot", lead: "This is the journey for a client who finds your studio in the app.",
      steps: [
        "The client tries designs in AR — from the library, your marketplace or their own sketch.",
        "The design locks to the skin at 1:1 scale after calibration — size shown in centimetres.",
        "The client finds your studio under Discover → Studios by map, distance and style.",
        "The client sends the design, a message or a booking request to your inbox.",
        "You reply with a calendar link, the client picks a time and pays a deposit in-app.",
      ],
       shotA: { alt: "InkSimulator's current live camera introduction", caption: "Live AR — turn on camera" },
      shotB: { alt: "Discover → Studios with map and style filters", caption: "Discover → Studios" },
    },
    features: {
      num: "03", h: "Everything you can do in the artist panel", lead: "The panel is split into tabs. Here's the overview — details below.",
      items: [
        { icon: "palette", t: "Sell designs (Pilot)", d: "Upload designs to the library and marketplace. Clients buy in-app, you get paid per design." },
        { icon: "sparkles", t: "Custom sketch projects", d: "The client describes the idea, you create versions and send them back in-app. Our sketch tool is compatible with file formats from ProCreate and others." },
        { icon: "calendar", t: "Book sessions", d: "Set sessions and minutes, send a calendar link. Booked slots block automatically." },
        { icon: "chat", t: "Chat with clients", d: "Clients send designs, questions and reference photos straight to your panel inbox." },
        { icon: "bell", t: "Notifications", d: "Get new requests by email, SMS or both — you choose in the panel." },
        { icon: "scan", t: "3D-scanned body parts", d: "Clients scan an arm or leg — the design wraps to the body shape." },
        { icon: "image", t: "Studio gallery", d: "Show your best work on your public profile." },
        { icon: "users", t: "Team & members", d: "Add artists and control who has access." },
        { icon: "clock", t: "Opening hours", d: "Set hours, block slots and sync with Google Calendar." },
        { icon: "tag", t: "Deals & pricing", d: "Create deals, price designs and manage deposits. Run a flash deal on short notice if you get cancellations." },
        { icon: "book", t: "Fortnox integration", d: "Connect your own Fortnox — payments and design sales are posted automatically. The integration is included; the Fortnox subscription comes from Fortnox." },
        { icon: "globe", t: "Own profile & SEO", d: "Your own studio profile on our .com domain with backlinks — can help you rank higher on Google." },
        { icon: "pulse", t: "Posture Pro", d: "Included — worth 999 kr/year. Measure posture with the camera on an iPad or computer, get exercise suggestions and warnings when posture has been harmful for a longer time." },
      ],
    },
    start: {
      num: "04", h: "Get started", lead: "Accounts are always created by InkSimulator together with the studio. After that it takes a few minutes.",
      steps: [
        { t: "Get your account", d: "We register the studio account and give you an email and a temporary password." },
        { t: "First login", d: "Go to inksimulator.com/artists → Log in. Use your email and the temporary password." },
        { t: "Choose your own password", d: "You must set your own password (min. 8 characters). The panel then opens." },
        { t: "Forgot your password?", d: "Tap Forgot password on the login page — you'll get a link by email." },
      ],
      note: "Registration is handled by InkSimulator and never happens via a public page.",
      shotA: { alt: "Registration form filled in by InkSimulator", caption: "Account registered by InkSimulator" },
      shotB: { alt: "Screen for choosing your own password", caption: "Choose your password" },
    },
    profile: {
      num: "05", h: "Profile, team & verification", lead: "A complete profile helps clients understand what you offer. Everything is managed under Profile & look.",
      items: [
        "Studio name, tagline and description — tell about styles and price level.",
        "Logo — shown in search, chat and bookings. Change it any time.",
        "Address, city, phone, website and Instagram — optional but recommended.",
        "Map position is required for clients to find you via “near me”.",
      ],
      team: { t: "Artist presentations and access", d: "Add public artist presentations under Artists on the studio page. Invitations and roles are managed separately under Team and access; records are not linked automatically." },
      verify: { t: "Verification", d: "Verified means the contact email is confirmed and business documentation is registered. It is not a hygiene inspection. Documents are seen only by InkSimulator." },
      shot: { alt: "Panel, Profile & look", caption: "Panel → Profile & look" },
    },
    designs: {
      num: "06", h: "Designs, gallery & deals", lead: "Three tabs for what you sell and show.",
      tabs: [
        { k: "designs", d: "Upload designs — set title, category (Japanese, Realistic, Blackwork…) and price. Clients buy in-app." },
        { k: "gallery", d: "Upload photos of finished tattoos to your public profile." },
        { k: "deals", d: "Create campaigns and package prices." },
      ],
      shotA: { alt: "Panel, designs tab", caption: "Panel → designs" },
      shotB: { alt: "Panel, gallery tab", caption: "Panel → gallery" },
    },
    bookings: {
      num: "07", h: "Bookings, calendar & messages", lead: "Full control of your time — no double bookings.",
      tabs: [
        { k: "hours", d: "Set opening hours and availability per day." },
        { k: "calendar", d: "See all bookings and block slots right in the panel calendar." },
        { k: "google calendar", d: "Connect your studio Google account in one click. Bookings sync and busy slots block automatically, so there are no double bookings." },
        { k: "session length", d: "When you approve a request you pick the number of sessions (1–4) and hours per session (1–8). The calendar link the client gets uses that time." },
        { k: "calendar link", d: "The client picks a free slot, pays a deposit and the slot is blocked." },
        { k: "notifications", d: "Choose email, SMS or both. Add your mobile number with country code and send a test SMS to be sure it works." },
        { k: "requests & chat", d: "All requests land in your inbox — reply directly in-app." },
      ],
      shotA: { alt: "Panel, hours tab", caption: "Panel → hours" },
      shotB: { alt: "Panel, bookings tab with calendar", caption: "Panel → bookings" },
    },
    cost: {
      num: "08", h: "Frequently asked questions", lead: "Answers to common studio questions.",
      faq: [
        { q: "Does it cost anything?", a: "Free trial throughout 2026 with no fixed studio fee or commission. Prices shown in SEK." },
        { q: "Is Posture Pro included?", a: "Yes — worth 999 kr/year at no extra cost. Measure your posture with the camera on an iPad or computer, get exercise suggestions and a warning when your posture has been harmful for a longer time. Swedish law requires proactive work-environment and health work." },
        { q: "Can we connect Fortnox?", a: "Yes — the Fortnox integration is included and connects with one tap in the panel. The Fortnox subscription itself comes from Fortnox. Deposits, tattoo payments and design sales are posted automatically." },
        { q: "Will you help us show up on Google?", a: "You get your own studio profile on our .com domain with plenty of backlinks. That can help you rank higher on Google and other search engines — but we can't promise a specific position, the search engines decide." },
        { q: "Does the client need a photo?", a: "No. Clients can contact your studio and send a booking request without a photo." },
        { q: "Can artists share a studio?", a: "Yes. Manage public presentations under Artists on the studio page and user access under Team and access." },
        { q: "Who sees our documents?", a: "Only InkSimulator. Documents are not public." },
      ],
      cta: "Ready to get started?", ctaSub: "Contact us and we'll help set up your studio account.",
    },
    footer: "© InkSimulator · Studio guide",
  },
} as const;

const STUDIO_PHONE = "tel:+46793288098";

function Shot({ src, s, className = "" }: { src: string; s?: Shot; className?: string }) {
  return (
    <figure className={`border border-border bg-background ${className}`}>
      <img src={src} alt={s?.alt ?? "InkSimulator studio guide"} loading="lazy" className="block w-full h-auto" />
      {s?.caption && <figcaption className={`${MONO} text-[11px] uppercase border-t border-border px-3 py-2 bg-primary text-primary-foreground`}>{s.caption}</figcaption>}
    </figure>
  );
}

const SETUP = {
  sv: {
    h1: "Kom igång med din studio",
    intro: "Har du fått ditt studiokonto? Följ stegen här för att göra studion redo.",
    noAccount: "Inget konto ännu?", noAccountLink: "Anmäl intresse", featuresLink: "Funktioner och priser för studios",
    topics: "Ämnen", stepsLabel: "Steg för steg", moreLabel: "Fler ämnen", step: "Steg",
    s: ["Logga in och välj eget lösenord", "Fyll i profil och lägg till arbetsprover", "Lägg till team och behörigheter", "Ställ in tider och aviseringar", "Anslut integrationer"],
    integrationsLead: "Anslut de integrationer studion ska använda.",
    worksLead: "Lägg upp foton på färdiga tatueringar under fliken gallery.",
    more: { designs: "Motiv & erbjudanden", bookings: "Kalender, bokningar & betalningar", posture: "Posture Pro", features: "Alla funktioner i panelen", cost: "Kostnad & vanliga frågor" },
    featuresNote: "Fullständig beskrivning av funktioner och priser finns i funktionsguiden.",
    whyH: "Varför InkSimulator?", journeyH: "Kundflödet", featuresH: "Flikar och verktyg",
  },
  en: {
    h1: "Get started with your studio",
    intro: "Got your studio account? Follow the steps here to get your studio ready.",
    noAccount: "No account yet?", noAccountLink: "Register your interest", featuresLink: "Features and pricing for studios",
    topics: "Topics", stepsLabel: "Step by step", moreLabel: "More topics", step: "Step",
    s: ["Log in and choose your own password", "Complete your profile and add your work", "Add your team and access", "Set hours and notifications", "Connect integrations"],
    integrationsLead: "Connect the integrations your studio will use.",
    worksLead: "Upload photos of finished tattoos under the gallery tab.",
    more: { designs: "Designs & deals", bookings: "Calendar, bookings & payments", posture: "Posture Pro", features: "All panel features", cost: "Cost & FAQ" },
    featuresNote: "The full description of features and pricing is in the features guide.",
    whyH: "Why InkSimulator?", journeyH: "Client flow", featuresH: "Tabs and tools",
  },
} as const;

function Tabs({ items }: { items: readonly { k: string; d: string }[] }) {
  return <dl className="mt-4">{items.map(x => <div key={x.k} className="border-t border-border py-3"><dt className="mb-1 inline-block rounded-md bg-secondary px-2 py-0.5 text-xs uppercase">{x.k}</dt><dd className="text-sm leading-relaxed">{x.d}</dd></div>)}</dl>;
}

export function StudioGuide({ routeLang = "en" }: { routeLang?: "en" | "sv" }) {
  const [lang, setLang] = usePublicStudioLang(routeLang);
  const t = T[lang];
  const c = SETUP[lang];
  const sv = lang === "sv";
  const [theme] = useStudioTheme();
  const featuresPath = sv ? "/sv/studio-guide" : "/studio-guide";
  const interestPath = sv ? "/sv/for-studios/interest" : "/for-studios/interest";
  const tab = (list: readonly { k: string; d: string }[], keys: string[]) => list.filter(x => keys.includes(x.k));
  // Old anchors (#why, #journey, …) may sit inside collapsed panels: open and scroll there.
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      const panel = el.closest("details");
      if (panel && !panel.open) panel.open = true;
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  const stepIds = ["start", "profile", "team", "hours", "integrations"];
  const moreIds = ["designs", "bookings", "posture", "features", "cost"] as const;
  const nav = [...stepIds.map((id, i) => ({ id, label: `${i + 1}. ${c.s[i]}` })), ...moreIds.map(id => ({ id, label: c.more[id] }))];
  const navList = (onPick?: (e: React.MouseEvent<HTMLAnchorElement>) => void) => <ol className="space-y-0.5">
    {nav.map((n, i) => <li key={n.id}>{i === stepIds.length && <p className="mb-1 mt-4 text-xs uppercase tracking-widest text-muted-foreground">{c.moreLabel}</p>}<a href={`#${n.id}`} onClick={onPick} className="block rounded-md py-2 pl-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">{n.label}</a></li>)}
  </ol>;
  const stepHead = (i: number, lead?: string) => <header className="mb-5">
    <p className="text-xs uppercase tracking-widest text-primary">{c.step} {i + 1}</p>
    <h2 className={`${DISPLAY} ds-glow-soft mt-2 text-3xl leading-tight md:text-4xl`}>{c.s[i]}</h2>
    {lead && <p className="mt-3 text-base leading-relaxed">{lead}</p>}
  </header>;
  const sec = "scroll-mt-28 border-t border-border py-10 first:border-t-0 first:pt-0";
  const topic = (id: string, title: string, body: React.ReactNode) => <details id={id} className="group scroll-mt-28 border-t border-border">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold">{title}<ChevronDown aria-hidden className="size-5 shrink-0 text-accent transition-transform group-open:rotate-180" /></summary>
    <div className="pb-8">{body}</div>
  </details>;

  return (
    <main id="studio-top" className={`${MONO} studio-guide studio-visual-profile ${theme === "bright" ? "studio-bright" : ""} min-h-screen bg-background text-foreground`} lang={lang}>
      <StudioTrackHeader lang={lang} onLang={setLang} theme sticky
        back={{ to: sv ? "/sv/for-studios" : "/for-studios", label: sv ? "Tillbaka till översikten" : "Back to overview" }} />
      <div className="mx-auto w-full max-w-7xl px-5 md:px-10">
        <section className="pb-6 pt-8 lg:pb-10 lg:pt-14">
          <h1 className={`${DISPLAY} ds-glow-soft max-w-[20ch] text-4xl leading-[1.05] sm:text-5xl lg:text-6xl`}>{c.h1}</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed">{c.intro}</p>
          <p className="mt-3 text-xs text-muted-foreground">{c.noAccount} <Link to={interestPath} className="underline underline-offset-4 hover:text-foreground">{c.noAccountLink}</Link> · <Link to={featuresPath} className="underline underline-offset-4 hover:text-foreground">{c.featuresLink}</Link></p>
        </section>

        <details className="mb-6 rounded-2xl border border-border bg-card px-4 lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm">{c.topics}<ChevronDown aria-hidden className="size-4" /></summary>
          <div className="pb-3">{navList(e => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; })}</div>
        </details>

        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
          <nav aria-label={t.navAria} className="hidden lg:block"><div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-6">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{c.stepsLabel}</p>
            {navList()}
          </div></nav>

          <div className="min-w-0 max-w-3xl pb-24">
            <section id="start" className={sec}>
              {stepHead(0, t.start.lead)}
              <ol className="space-y-5">
                {t.start.steps.map((s, i) => <li key={s.t} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-sm text-accent">{i === 3 ? <KeyRound className="size-4" /> : i + 1}</span>
                  <div><h3 className="text-sm font-bold">{s.t}</h3><p className="mt-1 text-sm leading-relaxed">{s.d}</p></div>
                </li>)}
              </ol>
              <p className="mt-6 border-l-2 border-accent pl-4 text-xs"><ShieldCheck className="mr-2 inline size-4 text-accent" />{t.start.note}</p>
              <div className="mt-6 grid grid-cols-2 items-start gap-4"><Shot src={imgAdminSignup} s={t.start.shotA} /><Shot src={imgSetPassword} s={t.start.shotB} /></div>
              <Link to={sv ? "/sv/artists" : "/artists"} className="btn-secondary mt-6 inline-flex"><LogIn className="mr-2 size-4 text-accent" />{t.hero.login}</Link>
            </section>

            <section id="profile" className={sec}>
              {stepHead(1, t.profile.lead)}
              <ul className="border-t border-border">{t.profile.items.map(i => <li key={i} className="flex gap-3 border-b border-border py-3 text-sm"><ArrowRight className="mt-0.5 size-4 shrink-0 text-accent" />{i}</li>)}</ul>
              <h3 className="mt-6 text-sm font-bold">{t.profile.verify.t}</h3><p className="mt-1 text-sm leading-relaxed">{t.profile.verify.d}</p>
              <p className="mt-6 text-sm leading-relaxed">{c.worksLead}</p>
              <Tabs items={tab(t.designs.tabs, ["gallery"])} />
              <div className="mt-6 grid gap-4 sm:grid-cols-2"><Shot src={imgDashProfile} s={t.profile.shot} /><Shot src={imgDashGallery} s={t.designs.shotB} /></div>
            </section>

            <section id="team" className={sec}>
              {stepHead(2, t.profile.team.d)}
            </section>

            <section id="hours" className={sec}>
              {stepHead(3)}
              <Tabs items={tab(t.bookings.tabs, ["hours", sv ? "aviseringar" : "notifications"])} />
              <div className="mt-6 max-w-sm"><Shot src={imgDashHours} s={t.bookings.shotA} /></div>
            </section>

            <section id="integrations" className={sec}>
              {stepHead(4, c.integrationsLead)}
              <Tabs items={[...tab(t.bookings.tabs, ["google kalender", "google calendar"]), { k: "Fortnox", d: t.included.fortnox.d }]} />
            </section>

            <div className="mt-6">
              {topic("designs", c.more.designs, <><Tabs items={tab(t.designs.tabs, ["designs", "deals"])} /><div className="mt-6 max-w-sm"><Shot src={imgDashDesigns} s={t.designs.shotA} /></div></>)}
              {topic("bookings", c.more.bookings, <><p className="text-sm">{t.bookings.lead}</p><Tabs items={t.bookings.tabs.filter(x => !["hours", "aviseringar", "notifications", "google kalender", "google calendar"].includes(x.k))} /><p className="mt-4 text-sm leading-relaxed">{t.included.bookings.d}</p><div className="mt-6 max-w-sm"><Shot src={imgDashBookings} s={t.bookings.shotB} /></div></>)}
              {topic("posture", c.more.posture, <p className="text-sm leading-relaxed">{t.included.posture.d}</p>)}
              {topic("features", c.more.features, <>
                <p className="text-sm">{c.featuresNote} <Link to={featuresPath} className="underline underline-offset-4">{c.featuresLink}</Link></p>
                <h3 id="why" className="mt-6 scroll-mt-28 text-sm font-bold">{c.whyH}</h3>
                <ul className="mt-2 space-y-2 text-sm leading-relaxed">{t.why.points.map(p => <li key={p.t}><strong>{p.t}:</strong> {p.d}</li>)}</ul>
                <h3 id="journey" className="mt-6 scroll-mt-28 text-sm font-bold">{c.journeyH}</h3>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed">{t.journey.steps.map(s => <li key={s}>{s}</li>)}</ol>
                <div className="mt-4 grid max-w-md grid-cols-2 gap-4"><Shot src={imgCameraPrimer} s={t.journey.shotA} /><Shot src={imgCommunity} s={t.journey.shotB} /></div>
                <h3 className="mt-6 text-sm font-bold">{c.featuresH}</h3>
                <ul className="mt-2 space-y-2 text-sm leading-relaxed">{(t.features.items as readonly Feat[]).map(f => <li key={f.t}><strong>{f.t}:</strong> {f.d}</li>)}</ul>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed">{[t.included.sms, t.included.seo, t.included.demand].map(x => <li key={x.t}><strong>{x.t}:</strong> {x.d}</li>)}</ul>
              </>)}
              {topic("cost", c.more.cost, <>
                <Link to="/pricing" className="btn-link text-sm">{t.pricingLink}</Link>
                <div className="mt-4 divide-y divide-border border-y border-border">{t.cost.faq.map(f => <details key={f.q} className="group py-4"><summary className="flex cursor-pointer list-none justify-between gap-4 text-sm font-bold">{f.q}<ChevronDown className="size-4 shrink-0 text-accent transition-transform group-open:rotate-180" /></summary><p className="mt-3 text-sm leading-relaxed">{f.a}</p></details>)}</div>
                <p className="mt-6 text-sm">{t.cost.ctaSub} <a href={STUDIO_PHONE} className="underline underline-offset-4">+46 79 328 80 98</a></p>
              </>)}
            </div>
            <a href="#studio-top" className="btn-link mt-10 inline-flex items-center gap-2 text-sm"><ArrowUp aria-hidden className="size-4" />{t.top}</a>
          </div>
        </div>
      </div>
    </main>
  );
}
