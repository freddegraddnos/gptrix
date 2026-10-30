import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, Eye, Loader2, ShoppingBag, Users } from "lucide-react";
import { StudioShell } from "@/components/StudioShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useStudioLang } from "@/lib/studioLang";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/insights")({
  head: () => ({
    meta: [
      { title: tx("Studio insights — InkSimulator") },
      {
        name: "description",
        content: "Sort your studio's bookings, sold designs and design views in one dashboard.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudioInsights,
});

type SlotRow = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  price_ore: number | null;
};
type SaleRow = {
  id: string;
  created_at: string;
  price_paid_ore: number;
  marketplace_motifs: { name: string } | null;
};
type MotifRow = { id: string; name: string; published: boolean; price_ore: number };
type PostRow = { id: string; tattoo_name: string | null; try_count: number; created_at: string };

type Tab = "bookings" | "sales" | "views";
const kr = (ore: number) => `${Math.round(ore / 100).toLocaleString()} kr`;

type Overview = {
  months: { month: string; bookings: number; revenue_ore: number }[];
  customers_total: number;
  customers_returning: number;
  projects_total: number;
  projects_from_inkvision: number;
};

function StudioOverview({ data }: { data: Overview }) {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const [month, setMonth] = useState(data.months[data.months.length - 1]?.month ?? "");
  const selected = data.months.find((m) => m.month === month) ?? data.months[data.months.length - 1];
  const peak = Math.max(1, ...data.months.map((m) => m.bookings));
  const share = data.customers_total
    ? Math.round((data.customers_returning / data.customers_total) * 100)
    : 0;
  const inkShare = data.projects_total
    ? Math.round((data.projects_from_inkvision / data.projects_total) * 100)
    : 0;

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
         <div><h2 className="text-sm font-black uppercase tracking-widest">{tr("Overview", "Översikt")}</h2><p className="text-[11px] text-muted-foreground">{tr("Last 12 months; choose a month for the figures below", "Senaste 12 månaderna; välj månad för siffrorna nedan")}</p></div>
        <select
           aria-label={tr("Month", "Månad")}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-white/15 bg-transparent px-2 py-1.5 text-[11px] uppercase tracking-widest"
        >
          {data.months.map((m) => (
            <option key={m.month} value={m.month}>
              {m.month}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex h-24 items-end gap-1">
        {data.months.map((m) => (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-t ${m.month === month ? "bg-accent" : "bg-accent/40"}`}
              style={{ height: `${Math.max(4, (m.bookings / peak) * 80)}px` }}
              title={`${m.month}: ${m.bookings} bookings`}
            />
            <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<CalendarClock className="size-4" />}
           label={`${tr("Bookings", "Bokningar")} ${selected?.month ?? ""}`}
           value={selected ? String(selected.bookings) : "—"}
        />
        <Stat
          icon={<ShoppingBag className="size-4" />}
           label={tr("Paid deposits + quotes for booked/completed projects", "Betalda handpenningar + offerter för bokade/slutförda projekt")}
           value={selected ? kr(selected.revenue_ore) : "—"}
        />
        <Stat
          icon={<Users className="size-4" />}
          label={tx("Returning")}
          value={`${data.customers_returning} · ${share}%`}
        />
        <Stat
          icon={<Eye className="size-4" />}
          label={tx("Via inksimulator.com")}
          value={`${data.projects_from_inkvision} · ${inkShare}%`}
        />
      </div>
    </section>
  );
}

function StudioInsights() {
  useUiLang();
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("bookings");
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [motifs, setMotifs] = useState<MotifRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sort, setSort] = useState<"date" | "value" | "status">("date");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const [s, m, p] = await Promise.all([
        supabase
          .from("studio_slots")
          .select("id, starts_at, duration_minutes, status, price_ore")
          .eq("studio_id", user.id),
        supabase
          .from("marketplace_motifs")
          .select("id, name, published, price_ore")
          .eq("artist_id", user.id),
        supabase
          .from("posts")
          .select("id, tattoo_name, try_count, created_at")
          .eq("user_id", user.id),
      ]);
      const motifIds = (m.data ?? []).map((x) => x.id);
      const sale = motifIds.length
        ? await supabase
            .from("motif_purchases")
            .select("id, created_at, price_paid_ore, marketplace_motifs(name)")
            .in("motif_id", motifIds)
        : { data: [] as SaleRow[] };
      const { data: overviewData } = await supabase.rpc("studio_overview", { _studio: user.id });
      if (!alive) return;
      setOverview((overviewData ?? null) as Overview | null);
      setSlots((s.data ?? []) as SlotRow[]);
      setMotifs((m.data ?? []) as MotifRow[]);
      setPosts((p.data ?? []) as PostRow[]);
      setSales((sale.data ?? []) as unknown as SaleRow[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const flip = (n: number) => (dir === "desc" ? -n : n);
  const sortedSlots = useMemo(
    () =>
      [...slots].sort((a, b) => {
        if (sort === "value") return flip((a.price_ore ?? 0) - (b.price_ore ?? 0));
        if (sort === "status") return flip(a.status.localeCompare(b.status));
        return flip(new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      }),
    [slots, sort, dir],
  );
  const sortedSales = useMemo(
    () =>
      [...sales].sort((a, b) =>
        sort === "value"
          ? flip(a.price_paid_ore - b.price_paid_ore)
          : flip(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      ),
    [sales, sort, dir],
  );
  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) =>
        sort === "value"
          ? flip(a.try_count - b.try_count)
          : flip(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      ),
    [posts, sort, dir],
  );

  const revenue = sales.reduce((n, s) => n + s.price_paid_ore, 0);
  const views = posts.reduce((n, p) => n + (p.try_count ?? 0), 0);
  const confirmed = slots.filter((s) => s.status === "booked").length;
  const pending = slots.filter((s) => s.status === "requested" || s.status === "proposed").length;

  const chip = (active: boolean) =>
    `rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
      active ? "bg-accent text-black" : "border border-white/15 text-muted-foreground"
    }`;

  return (
    <StudioShell current="insights" narrow>
      <div>
        <p className="-mt-3 text-sm text-muted-foreground">
           {tr("Bookings, sold designs and how often people try your work on.", "Bokningar, sålda motiv och hur ofta personer provar dina verk.")}
        </p>

        {!authLoading && !user && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
            {tx("Sign in with your studio account to see insights.")}
          </div>
        )}

        {user && loading && (
          <div className="mt-10 flex justify-center">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        )}

        {user && !loading && (
          <>
             {overview ? <StudioOverview data={overview} /> : <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">{tr("Overview data is unavailable. No zero values are inferred.", "Översiktsdata saknas. Inga nollvärden antas.")}</section>}
             <p className="mt-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{tr("All-time totals from calendar slots, marketplace purchases and published posts", "Totaler för hela perioden från kalendertider, marknadsplatsköp och publicerade inlägg")}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
               <Stat icon={<CalendarClock className="size-4" />} label={tr("Booked calendar slots", "Bokade kalendertider")} value={String(confirmed)} />
               <Stat icon={<CalendarClock className="size-4" />} label={tr("Requested/proposed calendar slots", "Begärda/föreslagna kalendertider")} value={String(pending)} />
               <Stat icon={<ShoppingBag className="size-4" />} label={tr("Marketplace design sales", "Motivförsäljning på marknadsplatsen")} value={kr(revenue)} />
               <Stat icon={<Eye className="size-4" />} label={tr("Recorded try-ons on posts", "Registrerade provningar av inlägg")} value={String(views)} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button className={chip(tab === "bookings")} onClick={() => setTab("bookings")}>
                {tx("Bookings")}
              </button>
              <button className={chip(tab === "sales")} onClick={() => setTab("sales")}>
                {tx("Sold designs")}
              </button>
              <button className={chip(tab === "views")} onClick={() => setTab("views")}>
                {tx("Views")}
              </button>
              <span className="ml-auto flex items-center gap-2">
                <select
                  aria-label={tx("Sort by")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="rounded-xl border border-white/15 bg-transparent px-2 py-1.5 text-[11px] uppercase tracking-widest"
                >
                  <option value="date">{tx("Date")}</option>
                  <option value="value">{tab === "views" ? tx("Try-ons") : tx("Amount")}</option>
                  {tab === "bookings" && <option value="status">{tx("Status")}</option>}
                </select>
                <button
                  onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
                  className="rounded-xl border border-white/15 px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest"
                >
                  {dir === "desc" ? "↓" : "↑"}
                </button>
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {tab === "bookings" &&
                sortedSlots.map((s) => (
                  <Row
                    key={s.id}
                    title={new Date(s.starts_at).toLocaleString()}
                    sub={`${s.duration_minutes} min · ${s.status}`}
                    value={s.price_ore != null ? kr(s.price_ore) : "—"}
                  />
                ))}
              {tab === "sales" &&
                sortedSales.map((s) => (
                  <Row
                    key={s.id}
                    title={s.marketplace_motifs?.name ?? tx("Design")}
                    sub={new Date(s.created_at).toLocaleDateString()}
                    value={kr(s.price_paid_ore)}
                  />
                ))}
              {tab === "views" &&
                sortedPosts.map((p) => (
                  <Row
                    key={p.id}
                    title={p.tattoo_name ?? tx("Design")}
                    sub={new Date(p.created_at).toLocaleDateString()}
                    value={`${p.try_count ?? 0} try-ons`}
                  />
                ))}
              {((tab === "bookings" && sortedSlots.length === 0) ||
                (tab === "sales" && sortedSales.length === 0) ||
                (tab === "views" && sortedPosts.length === 0)) && (
                <li className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground">
                  {tx("Nothing here yet.")}
                  {tab === "sales" && motifs.length === 0 && tx(" Publish a design to start selling.")}
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </StudioShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function Row({ title, sub, value }: { title: string; sub: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">{sub}</div>
      </div>
      <div className="shrink-0 text-sm font-bold text-accent">{value}</div>
    </li>
  );
}
