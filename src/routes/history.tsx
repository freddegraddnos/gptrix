import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Camera, Clock, ImageIcon, Ruler, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTryonHistory, type TryonEntry } from "@/hooks/useTryonHistory";
import { poseLabel } from "@/lib/poses";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: tx("My try-on history — InkSimulator") },
      {
        name: "description",
        content:
          "All your AR try-ons collected chronologically — reopen a previous placement or delete it.",
      },
      { property: "og:title", content: "My try-on history — InkSimulator" },
      {
        property: "og:description",
        content: "See every AR test you've done: motif, placement, size and time.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HistoryPage,
});

function groupByDay(entries: TryonEntry[]) {
  const map = new Map<string, TryonEntry[]>();
  for (const e of entries) {
    const key = new Date(e.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return [...map.entries()];
}

function HistoryPage() {
  useUiLang();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { entries, remove } = useTryonHistory(user?.id);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/history" } });
  }, [loading, user, navigate]);

  const days = useMemo(() => groupByDay(entries), [entries]);

  return (
    <AppShell>
      <header className="mb-5">
        <div className="text-mono-caps text-[10px] text-accent">{tx("History")}</div>
        <h1 className="mt-1 font-display font-bold text-2xl">{tx("My history")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {entries.length === 0
            ? tx("Every AR test you do is saved here automatically.")
            : `${entries.length} try-on${entries.length === 1 ? "" : "s"} saved`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {tx("To compare try-ons side by side, use your")}{" "}
          <Link to="/projects" className="font-bold text-accent underline">{tx("saved projects")}</Link>{" "}
          {tx("or go straight to")}{" "}
          <Link to="/compare" className="font-bold text-accent underline">{tx("Compare")}</Link>.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <Clock className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {tx("Take an AR photo and the try-on will show up here.")}
          </p>
          <Link
            to="/ar"
            className="mt-4 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
          >
            {tx("Open AR camera")}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(([day, list]) => (
            <section key={day}>
              <h2 className="text-mono-caps text-[10px] text-muted-foreground mb-2">
                {day}
              </h2>
              <ul className="space-y-2">
                {list.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-2xl border border-white/10 bg-slate p-3 flex gap-3"
                  >
                    <div className="size-16 shrink-0 rounded-xl overflow-hidden bg-ink grid place-items-center">
                      {e.preview_url ? (
                        <img
                          src={e.preview_url}
                          alt={e.motif_name ?? tx("Try-on")}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">
                        {e.motif_name ?? tx("Motif")}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <span>
                          {new Date(e.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {e.width_cm != null && (
                          <span className="flex items-center gap-1">
                            <Ruler className="size-3" />
                            {Number(e.width_cm).toFixed(1)} cm
                          </span>
                        )}
                        {e.body_part && <span>{e.body_part}</span>}
                        {poseLabel(e.pose) && (
                          <span className="rounded-full border border-white/15 px-1.5 py-px">
                            {poseLabel(e.pose)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Link
                          to="/ar"
                          search={{
                            motif: e.motif_id ?? undefined,
                            w: e.width_cm != null ? String(e.width_cm) : undefined,
                            r: e.rotation != null ? String(e.rotation) : undefined,
                          }}
                          className="h-8 px-3 rounded-lg bg-accent text-ink font-bold text-[10px] uppercase tracking-widest flex items-center gap-1"
                        >
                          <Camera className="size-3" />
                          {tx("Open in AR")}
                        </Link>
                        <button
                          onClick={() => remove(e.id)}
                          aria-label={tx("Delete try-on")}
                          className="size-8 rounded-lg border border-white/10 text-muted-foreground hover:text-destructive grid place-items-center"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
