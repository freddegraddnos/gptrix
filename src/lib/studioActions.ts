import type { NavKey } from "@/lib/studioNav";

/** Searchable list of studio-panel actions. Pure data + search; no AI. */
export type StudioAction = {
  key: string;
  nav: NavKey;
  name: { en: string; sv: string };
  desc: { en: string; sv: string };
  words: string[];
};

const a = (key: string, nav: NavKey, en: string, sv: string, dEn: string, dSv: string, words: string): StudioAction =>
  ({ key, nav, name: { en, sv }, desc: { en: dEn, sv: dSv }, words: words.split(",").map(w => w.trim()) });

export const STUDIO_ACTIONS: StudioAction[] = [
  a("inbox", "requests", "Inbox", "Inkorg", "Read and reply to client requests.", "Läs och svara på kundförfrågningar.", "meddelanden,messages,förfrågningar,requests,chatt,chat,svara,reply,kunder skriver,mail,inbox"),
  a("sms", "notifs", "SMS notifications", "SMS-aviseringar", "Get a text when something new happens.", "Få ett SMS när något nytt händer.", "sms,sms-aviseringar,text,mobil,telefon,meddelanden,messages,avisering,notis,notification,alert"),
  a("email", "notifs", "Email notifications", "E-postaviseringar", "Choose where notifications are sent.", "Välj vart aviseringarna skickas.", "e-post,epost,email,mejl,mail,meddelanden,messages,avisering,notis,notification,mottagare"),
  a("notices", "notifications", "Notifications", "Aviseringar", "See what has happened lately.", "Se vad som hänt senast.", "notiser,händelser,nytt,uppdateringar,updates,klocka,bell"),
  a("motif", "motiv", "Upload a design", "Lägg upp motiv", "Publish designs for requests or sale.", "Publicera motiv för förfrågningar eller försäljning.", "motiv,design,flash,ladda upp,upload,publicera,sälja,sell,butik,shop,marknadsplats"),
  a("gallery", "gallery", "Gallery – finished tattoos", "Galleri – utförda tatueringar", "Show photos of your finished work.", "Visa foton av ditt färdiga arbete.", "galleri,portfolio,bilder,foton,photos,arbetsprover,work samples,utförda"),
  a("profile", "profil", "Profile & look", "Profil & utseende", "Edit your studio page.", "Redigera din studiosida.", "profil,studiosida,sida,utseende,logga,logo,adress,beskrivning,bio,öppettider"),
  a("bookings", "bokningar", "Bookings", "Bokningar", "See and manage booked sessions.", "Se och hantera bokade tider.", "bokningar,bokning,booking,tider,sessions,sittningar,avboka,cancel"),
  a("calendar", "kalender", "Calendar", "Kalender", "See your schedule.", "Se ditt schema.", "kalender,schema,calendar,dag,vecka"),
  a("hours", "hours", "Availability", "Tillgänglighet", "Publish free times clients can book.", "Lägg ut lediga tider som kunder kan boka.", "lediga tider,tillgänglighet,availability,öppettider,tider,slots,luckor"),
  a("sync", "sync", "Calendar sync", "Kalendersynk", "Connect Google Calendar.", "Koppla Google Kalender.", "google,kalendersynk,synk,sync,ical,koppla kalender"),
  a("clients", "clients", "Clients", "Kunder", "Find a client and their history.", "Hitta en kund och deras historik.", "kunder,kund,clients,kundregister,historik,kontakter"),
  a("sketches", "skisser", "Private sketches", "Privata skisser", "Save drafts only you see.", "Spara utkast som bara du ser.", "skisser,utkast,sketch,draft,ritningar"),
  a("tools", "skapa", "Design tools & stencil", "Designverktyg & stencil", "Draw, make text and stencils.", "Rita, gör text och stenciler.", "rita,draw,stencil,schablon,text,typsnitt,font,verktyg"),
  a("services", "tjanster", "Services & prices", "Tjänster & priser", "Set your prices and services.", "Ange priser och tjänster.", "priser,pris,price,tjänster,services,timpris,kostnad"),
  a("deals", "deals", "Deals", "Erbjudanden", "Create offers and campaigns.", "Skapa erbjudanden och kampanjer.", "erbjudanden,rabatt,discount,kampanj,deal,flash day"),
  a("team", "members", "Team and access", "Team och åtkomst", "Invite artists and set access.", "Bjud in artister och styr åtkomst.", "team,personal,artister,bjud in,invite,åtkomst,behörighet,access,kollega"),
  a("payments", "sales", "Payments & Fortnox", "Betalningar & Fortnox", "Payouts, sales and bookkeeping.", "Utbetalningar, försäljning och bokföring.", "betalning,payment,stripe,fortnox,bokföring,utbetalning,payout,faktura,deposition"),
  a("agent", "agent", "Booking agent", "Bokningsagent", "Optional assistant that answers clients.", "Valfri assistent som svarar kunder.", "agent,ai,assistent,bot,chattbot,automatiskt svar"),
  a("lang", "prefs", "Language & theme", "Språk & tema", "Switch language or dark/bright mode.", "Byt språk eller mörkt/ljust läge.", "språk,language,engelska,svenska,tema,mörkt,ljust,dark,bright"),
  a("stats", "insights", "Statistics", "Statistik", "See visits and requests over time.", "Se besök och förfrågningar över tid.", "statistik,stats,besök,analys,insights,siffror"),
  a("guide", "guide", "Setup guide", "Kom igång", "Step-by-step help to get started.", "Steg-för-steg-hjälp att komma igång.", "hjälp,help,guide,manual,kom igång,start,instruktioner"),
];

export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Score one query token against one candidate word: lower is better, null = no match. */
function tokenScore(q: string, word: string): number | null {
  if (word === q) return 0;
  if (word.startsWith(q) && q.length >= 2) return 1;
  if (q.length >= 4 && word.includes(q)) return 2;
  const tol = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  if (tol && lev(q, word.slice(0, Math.max(q.length, word.length)), tol) <= tol) return 3;
  if (tol && word.length > q.length && lev(q, word.slice(0, q.length), tol) <= tol) return 4;
  return null;
}

export function searchStudioActions(query: string, actions: StudioAction[] = STUDIO_ACTIONS): StudioAction[] {
  const tokens = normalize(query).split(" ").filter(t => t.length >= 2);
  if (!tokens.length) return [];
  const scored: Array<{ a: StudioAction; s: number }> = [];
  for (const act of actions) {
    const words = [act.name.en, act.name.sv, ...act.words].flatMap(w => normalize(w).split(" ")).filter(Boolean);
    let total = 0;
    let ok = true;
    for (const t of tokens) {
      let best: number | null = null;
      for (const w of words) {
        const s = tokenScore(t, w);
        if (s !== null && (best === null || s < best)) best = s;
      }
      if (best === null) { ok = false; break; }
      total += best;
    }
    if (ok) scored.push({ a: act, s: total });
  }
  return scored.sort((x, y) => x.s - y.s).map(x => x.a);
}
