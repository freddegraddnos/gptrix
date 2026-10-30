import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getVoteResults, type VoteChoice } from "@/lib/votes.functions";

export const Route = createFileRoute("/vote-results/$slug")({
  head: () => ({
    meta: [
      { title: "Vote results — InkSimulator" },
      {
        name: "description",
        content:
          "See how many friends voted on your tattoo and the exact yes/no split for that share link.",
      },
      { property: "og:title", content: "Vote results — InkSimulator" },
      {
        property: "og:description",
        content: "Live tally of your tattoo poll: votes, yes/no split and who voted.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VoteResultsPage,
});

const LABEL: Record<VoteChoice, string> = { yes: "Yes", no: "No", a: "Design A", b: "Design B" };

function VoteResultsPage() {
  const { slug } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["vote-results-page", slug],
    queryFn: () => getVoteResults({ data: { slug } }),
    refetchInterval: 20_000,
  });

  const total = data?.total ?? 0;
  const tally = data?.tally ?? { yes: 0, no: 0, a: 0, b: 0 };
  const pair: VoteChoice[] = data?.type === "a_b" ? ["a", "b"] : ["yes", "no"];
  const pct = (c: VoteChoice) => (total > 0 ? Math.round((tally[c] / total) * 100) : 0);
  const leader = pct(pair[0]!) >= pct(pair[1]!) ? pair[0]! : pair[1]!;

  return (
    <AppShell>
      <header className="mb-5">
        <Link
          to="/v/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent"
        >
          <ArrowLeft className="size-3.5" /> Back to the poll
        </Link>
        <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">
          Vote results
        </h1>
        {data?.caption && (
          <p className="mt-1 text-sm text-muted-foreground">{data.caption}</p>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading results…</p>}

      {error && !isLoading && (
        <p className="text-sm text-muted-foreground">
          We could not load this poll. Make sure you are signed in with the account
          that created the share link.
        </p>
      )}

      {data && (
        <>
          {/* Headline count */}
          <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-accent">
              <Users className="size-4" />
              <span className="text-mono-caps text-[10px]">Friends who voted</span>
            </div>
            <div className="mt-1 text-5xl font-display font-bold tabular-nums">
              {total}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {total === 0
                ? "No votes yet — share the link again."
                : `${LABEL[leader]} is leading with ${pct(leader)}%`}
            </p>
          </section>

          {/* Split */}
          <section className="mt-4 space-y-3">
            {pair.map((c) => (
              <div key={c} className="rounded-2xl border border-white/10 bg-ink/60 p-4">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="flex items-center gap-2">
                    {c === "yes" && <ThumbsUp className="size-4 text-accent" />}
                    {c === "no" && <ThumbsDown className="size-4 text-muted-foreground" />}
                    {LABEL[c]}
                  </span>
                  <span className="tabular-nums">
                    {tally[c]} {tally[c] === 1 ? "vote" : "votes"} · {pct(c)}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c === "no" ? "bg-muted-foreground/60" : "bg-accent"
                    }`}
                    style={{ width: `${pct(c)}%` }}
                  />
                </div>
              </div>
            ))}
          </section>

          {/* Who voted */}
          <h2 className="mt-6 mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Who voted
          </h2>
          {data.voters.length === 0 ? (
            <p className="text-sm text-muted-foreground pb-6">Nobody has voted yet.</p>
          ) : (
            <ul className="space-y-2 pb-6">
              {data.voters.map((v, i) => (
                <li
                  key={`${v.createdAt}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink/50 p-3"
                >
                  {v.avatarUrl ? (
                    <img
                      src={v.avatarUrl}
                      alt=""
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-white/10 grid place-items-center text-[11px] font-bold">
                      {v.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{v.displayName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {v.isGuest ? "Guest" : "InkSimulator user"}
                    </div>
                  </div>
                  {v.choice && (
                    <span
                      className={`px-2.5 h-7 grid place-items-center rounded-full text-[11px] font-bold ${
                        v.choice === "no"
                          ? "bg-white/10 text-muted-foreground"
                          : "bg-accent text-ink"
                      }`}
                    >
                      {LABEL[v.choice]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
