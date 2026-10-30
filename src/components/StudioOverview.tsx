import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CalendarDays, Inbox, Bot, CalendarPlus, Palette, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t, useStudioLang } from "@/lib/studioLang";
import type { StudioTab } from "@/components/StudioWorkspace";

import { tx, useUiLang } from "@/lib/uiLang";
import { StudioOnboarding } from "@/components/StudioOnboarding";
type Item = { id: string; when: string; who: string; source: string };

const L = {
  today: { en: "Today's bookings", sv: "Dagens bokningar" },
  none: { en: "Nothing booked today.", sv: "Inga bokningar i dag." },
  requests: { en: "Unread requests", sv: "Olästa förfrågningar" },
  requestsHelp: { en: "Requests you have not opened yet", sv: "Förfrågningar som du ännu inte har öppnat" },
  unread: { en: "Unread notices", sv: "Olästa aviseringar" },
  quick: { en: "Quick actions", sv: "Snabbknappar" },
  addTime: { en: "Publish free times", sv: "Lägg ut lediga tider" },
  agent: { en: "Booking agent · Optional", sv: "Bokningsagent · Valfritt" },
  look: { en: "Studio page look", sv: "Studiosidans utseende" },
  open: { en: "Open", sv: "Öppna" },
};

/** Studio panel start page: today, new requests, unread notices, shortcuts. */
export function StudioOverview({ studioId, onOpenTab }: { studioId: string; onOpenTab: (tab: StudioTab) => void }) {
  useUiLang();
  const [lang] = useStudioLang();
  const [today, setToday] = useState<Item[] | null>(null);
  const [requests, setRequests] = useState<number | null>(null);
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86400000);
    const range = [start.toISOString(), end.toISOString()] as const;
    void (async () => {
      const [slots, agent, req, notes] = await Promise.all([
        supabase.from("studio_slots").select("id, starts_at, client_note").eq("studio_id", studioId).in("status", ["booked", "held"]).gte("starts_at", range[0]).lt("starts_at", range[1]),
        supabase.from("agent_bookings").select("id, starts_at, customer_name, status").eq("studio_id", studioId).in("status", ["confirmed", "pending"]).gte("starts_at", range[0]).lt("starts_at", range[1]),
        supabase.from("artist_client_projects").select("id", { count: "exact", head: true }).eq("artist_id", studioId).is("studio_read_at", null),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", studioId).is("read_at", null),
      ]);
      const agentSlotIds = new Set<string>();
      const items: Item[] = [
        ...(agent.data ?? []).map((b) => ({ id: b.id, when: b.starts_at, who: b.customer_name, source: lang === "sv" ? "Agent" : "Agent" })),
        ...(slots.data ?? []).filter((s) => !agentSlotIds.has(s.id)).map((s) => ({ id: s.id, when: s.starts_at, who: s.client_note?.slice(0, 40) || (lang === "sv" ? "Bokad tid" : "Booked slot"), source: lang === "sv" ? "Kalender" : "Calendar" })),
      ].sort((a, b) => a.when.localeCompare(b.when));
      setToday(items);
      setRequests(req.count ?? 0);
      setUnread(notes.count ?? 0);
    })();
  }, [studioId, lang]);

  const card = "rounded-2xl border border-border bg-card p-4";
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === "sv" ? "sv-SE" : "en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-3">
        <button type="button" onClick={() => onOpenTab("notifs")} className={`${card} text-left transition-colors hover:border-accent`}>
          <p className="flex items-center gap-2 text-xs uppercase text-accent"><Inbox className="size-4" />{t({ en: "Main task 1", sv: "Huvuduppgift 1" }, lang)}</p>
          <h3 className="mt-2 font-display text-2xl uppercase">{t({ en: "Receive client requests", sv: "Ta emot kundförfrågningar" }, lang)}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t({ en: "Get the right notifications by email or SMS.", sv: "Få rätt aviseringar via e-post eller SMS." }, lang)}</p>
        </button>
        <button type="button" onClick={() => onOpenTab("motiv")} className={`${card} text-left transition-colors hover:border-accent`}>
          <p className="flex items-center gap-2 text-xs uppercase text-accent"><Palette className="size-4" />{t({ en: "Main task 2", sv: "Huvuduppgift 2" }, lang)}</p>
          <h3 className="mt-2 font-display text-2xl uppercase">{t({ en: "Publish designs", sv: "Publicera motiv" }, lang)}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t({ en: "Market your studio or offer designs for sale.", sv: "Marknadsför studion eller erbjud motiv till försäljning." }, lang)}</p>
        </button>
      </div>
      <div className="md:col-span-2 xl:col-span-3"><StudioOnboarding userId={studioId} onUploadDesign={() => onOpenTab("motiv")} /></div>
      <section className={`${card} md:col-span-2 xl:col-span-1 xl:row-span-2`}>
        <h3 className="flex items-center gap-2 font-display uppercase"><CalendarDays className="size-4 text-accent" />{t(L.today, lang)}</h3>
        {today === null ? <p className="mt-3 text-sm text-muted-foreground">…</p> : today.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t(L.none, lang)}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {today.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-12 font-bold">{time(i.when)}</span>
                <span className="min-w-0 flex-1 truncate">{i.who}</span>
                <span className="text-[11px] uppercase text-muted-foreground">{i.source}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => onOpenTab("bokningar")} className="mt-3 inline-flex items-center gap-1 text-xs underline">{t(L.open, lang)} <ArrowRight className="size-3" /></button>
      </section>
      <Link to="/artists/requests" className={`${card} block transition-colors hover:border-accent`}>
        <p className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Inbox className="size-4 text-accent" />{t(L.requests, lang)}</p>
         <p className="mt-2 font-display text-4xl">{requests ?? "…"}</p>
         <p className="mt-1 text-xs text-muted-foreground">{t(L.requestsHelp, lang)}</p>
      </Link>
       <Link to="/notifications" onClick={() => sessionStorage.setItem("inksimulator.studio-notifications", "1")} className={`${card} block transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`} aria-label={`${t(L.unread, lang)}: ${unread ?? t({ en: "loading", sv: "laddar" }, lang)}`}>
        <p className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Bell className="size-4 text-accent" />{t(L.unread, lang)}</p>
         <p className="mt-2 font-display text-4xl">{unread ?? "…"}</p>
        <p className="mt-2 text-xs text-muted-foreground">{lang === "sv" ? tx("Visa alla aviseringar →") : tx("View all notifications →")}</p>
      </Link>
      <section className={`${card} md:col-span-2`}>
        <h3 className="font-display uppercase">{t(L.quick, lang)}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {([["kalender", L.addTime, CalendarPlus], ["agent", L.agent, Bot], ["profil", L.look, Palette]] as const).map(([tab, label, Icon]) => (
            <button key={tab} type="button" onClick={() => onOpenTab(tab)} className="flex h-12 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-accent hover:text-accent-foreground">
              <Icon className="size-4" />{t(label, lang)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
