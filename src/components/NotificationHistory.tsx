import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CalendarClock, Box, MessageSquare, Heart, Search } from "lucide-react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import {
  matchesFilter,
  pathFor,
  isScanNotification,
  type NotificationFilter,
} from "@/lib/notificationLinks";

import { tx, useUiLang } from "@/lib/uiLang";
const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "booking", label: "Bookings" },
  { key: "scan", label: "3D scans" },
  { key: "message", label: "Messages" },
  { key: "community", label: "Community" },
];

function icon(n: Notification) {
  if (isScanNotification(n)) return <Box className="size-3.5 text-accent" />;
  if (n.kind === "booking") return <CalendarClock className="size-3.5 text-accent" />;
  if (n.kind === "message") return <MessageSquare className="size-3.5 text-accent" />;
  return <Heart className="size-3.5 text-accent" />;
}

export function NotificationHistory({ userId }: { userId: string | undefined }) {
  useUiLang();
  const navigate = useNavigate();
  const { items, loading, markRead } = useNotifications(userId);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return items.filter((n) => {
      if (!matchesFilter(n, filter)) return false;
      const ts = new Date(n.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (needle && !(n.body ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, filter, q, from, to]);

  const hasQuery = Boolean(q || from || to);

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-slate/40 p-3">
      <h2 className="mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {tx("Notification history")}
      </h2>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`h-8 shrink-0 rounded-full border px-3 text-[11px] font-bold ${
              filter === f.key
                ? "border-accent bg-accent text-ink"
                : "border-white/10 text-muted-foreground"
            }`}
          >
            {tx(f.label)}
          </button>
        ))}
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-ink/40 px-3">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tx("Search artist, studio or booking…")}
            aria-label={tx("Search notifications")}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label={tx("From date")}
            className="h-9 flex-1 rounded-xl border border-white/10 bg-ink/40 px-2 text-[11px] outline-none"
          />
          <span className="text-[10px] text-muted-foreground">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label={tx("To date")}
            className="h-9 flex-1 rounded-xl border border-white/10 bg-ink/40 px-2 text-[11px] outline-none"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFrom("");
                setTo("");
              }}
              className="h-9 shrink-0 rounded-xl border border-white/10 px-3 text-[11px] font-bold text-muted-foreground"
            >
              {tx("Clear")}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{tx("Loading…")}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
          <Bell className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-xs text-muted-foreground">{tx("Nothing in this filter yet.")}</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  void markRead(n.id);
                  void navigate({ to: pathFor(n) as never });
                }}
                className={`flex w-full items-start gap-2 rounded-xl border p-2.5 text-left ${
                  n.read_at ? "border-white/5" : "border-accent/30 bg-accent/5"
                }`}
              >
                <span className="mt-0.5">{icon(n)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">
                    {n.body || (n.kind === "follow" ? tx("New follower") : tx("Update"))}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </span>
                {!n.read_at && <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
