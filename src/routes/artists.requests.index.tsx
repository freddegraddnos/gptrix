import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Archive, CalendarCheck, CheckCircle2, Clock3, Copy, Loader2, Pencil, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { StudioShell } from "@/components/StudioShell";
import { RequireAuth } from "@/components/RequireAuth";
import { StudioButton as Button } from "@/components/StudioPrimitives";
import { useArtistRequests } from "@/hooks/useArtistRequests";
import { useAuth } from "@/hooks/useAuth";
import { useArtistMode } from "@/hooks/useArtistMode";
import { supabase } from "@/integrations/supabase/client";
import { studioBookingUrl } from "@/lib/studioBookingUrl";
import { studioAction, isUnread } from "@/lib/caseAction";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/artists/requests/")({
  head: () => ({ meta: [{ title: tx("Requests — InkSimulator Artist") }, { name: "description", content: "Manage tattoo requests, clients, quotes and conversations." }, { property: "og:title", content: "Artist Requests — InkSimulator" }, { property: "og:description", content: "Secure tattoo request workspace for InkSimulator studios." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <RequireAuth requireVerified title={tx("Sign in to manage requests")}><RequestsPage /></RequireAuth>,
});

const STATUS = {
  open: { label: "Open", icon: Clock3, className: "text-amber-300 bg-amber-500/10" },
  sketch_in_progress: { label: "Sketch in progress", icon: Pencil, className: "text-accent bg-accent/10" },
  changes_requested: { label: "Changes requested", icon: RefreshCw, className: "text-amber-300 bg-amber-500/10" },
  approved: { label: "Design approved", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-500/10" },
  booked: { label: "Booked", icon: CalendarCheck, className: "text-emerald-300 bg-emerald-500/10" },
  completed: { label: "Completed", icon: CheckCircle2, className: "text-accent bg-accent/10" },
  archived: { label: "Archived", icon: Archive, className: "text-muted-foreground bg-secondary" },
} as const;

function RequestsPage() {
  useUiLang();
  const { user } = useAuth();
  const { artist } = useArtistMode(user?.id);
  const [memberStudioId, setMemberStudioId] = useState<string | undefined>();
  useEffect(() => {
    let active = true;
    setMemberStudioId(undefined);
    if (user?.id) void supabase.from("studio_members").select("studio_id")
      .eq("user_id", user.id).eq("status", "active").in("role", ["admin", "artist"])
      .limit(1).maybeSingle().then(({ data }) => { if (active) setMemberStudioId(data?.studio_id); });
    return () => { active = false; };
  }, [user?.id]);
  const { requests, thumbnails, artists, loading, facts } = useArtistRequests(artist?.user_id ?? memberStudioId);
  const needsAction = useMemo(() => requests.flatMap((r) => { const f = facts[r.id]; const a = f && studioAction(f); return a ? [{ r, a, unread: isUnread(f) }] : []; }), [requests, facts]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [assigned, setAssigned] = useState("all");
  /** "Comparison requests" = the client sent the same idea to a few studios. */
  const [onlyComparison, setOnlyComparison] = useState(false);
  const comparisonCount = useMemo(() => requests.filter((r) => r.sent_to_multiple).length, [requests]);
  const filtered = useMemo(() => requests.filter((request) => {
    const haystack = `${request.client_name ?? ""} ${request.placement ?? ""} ${request.title}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === "all" || request.status === status) && (assigned === "all" || (assigned === "unassigned" ? !request.assigned_artist_id : request.assigned_artist_id === assigned)) && (!onlyComparison || request.sent_to_multiple);
  }), [requests, query, status, assigned, onlyComparison]);

  const bookingUrl = artist?.handle
    ? studioBookingUrl(artist.handle)
    : null;

  return <StudioShell current="requests">
    <p className="-mt-3 text-sm text-muted-foreground">{tx("Every tattoo brief, from first message to finished work.")}</p>
    {bookingUrl && <section className="my-5 flex items-center gap-3 border-y border-border py-4"><div className="min-w-0 flex-1"><p className="text-[11px] font-bold">{tx("Your booking link")}</p><p className="truncate text-xs text-muted-foreground">{bookingUrl}</p></div><Button type="button" variant="outline" size="icon" aria-label={tx("Copy booking link")} onClick={() => { void navigator.clipboard.writeText(bookingUrl); toast.success(tx("Booking link copied")); }}><Copy className="size-4" /></Button></section>}
    <section className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><label className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx("Search customer or placement")} className="h-11 w-full rounded-md border border-border bg-secondary pl-10 pr-3 text-sm outline-none focus:border-accent" /></label><select aria-label={tx("Filter by status")} value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-md border border-border bg-secondary px-3 text-sm"><option value="all">{tx("All statuses")}</option>{Object.entries(STATUS).map(([value, meta]) => <option key={value} value={value}>{tx(meta.label)}</option>)}</select><select aria-label={tx("Filter by artist")} value={assigned} onChange={(e) => setAssigned(e.target.value)} className="h-11 rounded-md border border-border bg-secondary px-3 text-sm"><option value="all">{tx("All artists")}</option><option value="unassigned">{tx("Unassigned")}</option>{artists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></section>
    {!loading && <section aria-labelledby="needs-action" className="mb-6 rounded-lg border border-accent/50 p-3">
      <div className="flex items-baseline justify-between gap-2"><h2 id="needs-action" className="font-display text-lg uppercase">{tx("Needs your action")}</h2><span className="text-xs text-muted-foreground">{needsAction.length}</span></div>
      {needsAction.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">{tx("Nothing is waiting for the studio right now.")}</p> : <ul className="mt-2 divide-y divide-border">{needsAction.map(({ r, a, unread }) => <li key={r.id}><Link to="/artists/requests/$id" params={{ id: r.id }} search={{ tab: a.tab }} className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-3 py-3"><span className="min-w-0"><span className="flex items-center gap-2 truncate font-bold">{unread && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">{tx("Unread")}</span>}{r.conversation_title || r.client_name || tx("Unnamed customer")}</span><span className="block truncate text-xs text-muted-foreground">{tx(a.reason)}</span></span><span className="text-xs font-bold text-accent">{tx(a.next)} →</span></Link></li>)}</ul>}
    </section>}
    {comparisonCount > 0 && <section className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border bg-secondary px-3 py-3"><p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">{comparisonCount}</span> {comparisonCount === 1 ? tx("request is") : tx("requests are")}{" "}{tx("from clients comparing a few studios — a quick reply helps.")}</p><Button variant="outline" type="button" onClick={() => setOnlyComparison((v) => !v)} className={`h-9 shrink-0 rounded-md px-3 text-[11px] font-bold ${onlyComparison ? "bg-accent text-accent-foreground" : "border border-border"}`}>{onlyComparison ? tx("Show all") : tx("Show these")}</Button></section>}
    {loading ? <div className="grid py-20 place-items-center"><Loader2 className="size-5 animate-spin text-accent" /></div> : filtered.length === 0 ? <div className="border-y border-dashed border-border py-16 text-center text-sm text-muted-foreground">{tx("No requests match these filters.")}</div> : <div className="divide-y divide-border border-y border-border">{filtered.map((request) => { const meta = STATUS[request.status as keyof typeof STATUS] ?? STATUS.open; const Icon = meta.icon; const artistName = artists.find((item) => item.id === request.assigned_artist_id)?.name; return <Link key={request.id} to="/artists/requests/$id" params={{ id: request.id }} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 py-4"><div className="size-14 overflow-hidden rounded-md bg-secondary">{thumbnails[request.id] ? <img src={thumbnails[request.id]} alt={tx("Latest reference")} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-lg font-bold text-accent">{(request.client_name ?? "?")[0]}</div>}</div><div className="min-w-0"><p className="flex items-center gap-2 truncate font-bold">{facts[request.id] && isUnread(facts[request.id]) && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">{tx("Unread")}</span>}{request.conversation_title || request.client_name || tx("Unnamed customer")}</p><p className="truncate text-xs text-muted-foreground">{request.placement ?? tx("Placement not set")}{artistName ? ` · ${artistName}` : tx(" · Unassigned")}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(request.latest_activity_at).toLocaleString()}</p>{request.sent_to_multiple && <p className="mt-1 inline-flex rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-accent">{tx("Comparing studios")}</p>}</div><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${meta.className}`}><Icon className="size-3" />{tx(meta.label)}</span></Link>; })}</div>}

  </StudioShell>;
}
