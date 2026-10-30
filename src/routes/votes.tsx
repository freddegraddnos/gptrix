import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Vote, ImageIcon, GitCompareArrows, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listMyVoteSessions, type MyVoteSession } from "@/lib/votes.functions";

export const Route = createFileRoute("/votes")({
  head: () => ({
    meta: [
      { title: "My votes — InkSimulator" },
      {
        name: "description",
        content:
          "See every vote you have shared with friends and how they voted on your tattoo ideas.",
      },
      { property: "og:title", content: "My votes — InkSimulator" },
      {
        property: "og:description",
        content: "Track yes/no and A/B votes your friends have cast on your tattoo ideas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyVotesPage,
});

function MyVotesPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<MyVoteSession[] | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listMyVoteSessions()
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <AppShell>
      <header className="mb-4">
        <div className="flex items-center gap-2 text-mono-caps text-[10px] text-accent">
          <Vote className="size-3" />
          Friend voting
        </div>
        <h1 className="mt-1 font-display font-bold text-2xl">My votes</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every vote link you have shared, with live results.
        </p>
      </header>

      <Link
        to="/compare"
        className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 h-11 text-xs font-bold uppercase tracking-widest text-accent"
      >
        <GitCompareArrows className="size-3.5" />
        Compare 2 photos & start a vote
      </Link>

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <Users className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            You haven't shared any votes yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const isAb = r.type === "a_b";
            const first = isAb ? r.tally.a : r.tally.yes;
            const second = isAb ? r.tally.b : r.tally.no;
            const pct = r.total > 0 ? Math.round((first / r.total) * 100) : 0;
            return (
              <li key={r.slug}>
                <Link
                  to="/vote-results/$slug"
                  params={{ slug: r.slug }}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5"
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-ink grid place-items-center">
                    {r.thumbnailUrl ? (
                      <img
                        src={r.thumbnailUrl}
                        alt={r.caption ?? "Vote"}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">
                      {r.caption || (isAb ? "Option 1 vs 2" : "Yes or no?")}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {r.total} {r.total === 1 ? "vote" : "votes"} ·{" "}
                      {isAb ? `1: ${first} / 2: ${second}` : `Yes ${first} / No ${second}`}
                      {r.expired ? " · expired" : ""}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
