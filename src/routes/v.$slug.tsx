import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, Lock, Share2, Sparkles, Unlock, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  castVote,
  getVoteResults,
  getVoteSession,
  setVoteProfileOpen,
  setVoteReactionEnabled,
  type PublicVoteSession,
  type VoteChoice,
  type VoterEntry,
} from "@/lib/votes.functions";
import { getDeviceId, getLocalVote, renderVoteSummary, setLocalVote } from "@/lib/voteShare";
import { ReactionRecorder } from "@/components/ReactionRecorder";
import { deleteReaction, listReactions } from "@/lib/reactions.functions";

export const Route = createFileRoute("/v/$slug")({
  head: () => ({
    meta: [
      { title: "Vote on the tattoo — InkSimulator" },
      {
        name: "description",
        content:
          "Help choose a tattoo: vote yes or no, or between design A and B. No sign-in required.",
      },
      { property: "og:title", content: "Vote on the tattoo — InkSimulator" },
      {
        property: "og:description",
        content: "Cast your vote on the design – yes/no or A/B, right in the browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VotePage,
});

const CHOICE_LABEL: Record<VoteChoice, string> = { yes: "Yes", no: "No", a: "A", b: "B" };

function VotePage() {
  const { slug } = Route.useParams();
  const [name, setName] = useState("");
  const [voted, setVoted] = useState<VoteChoice | null>(null);
  const [live, setLive] = useState<{
    tally: Record<VoteChoice, number>;
    total: number;
    voters: VoterEntry[];
    isProfileOpen: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [reactionOverride, setReactionOverride] = useState<boolean | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vote-session", slug],
    queryFn: () => getVoteSession({ data: { slug } }),
    staleTime: 30 * 1000,
  });

  const { data: creatorView, refetch: refetchCreator } = useQuery({
    queryKey: ["vote-results", slug],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      try {
        return await getVoteResults({ data: { slug } });
      } catch {
        return null;
      }
    },
    staleTime: 30 * 1000,
  });

  const { data: reactions, refetch: refetchReactions } = useQuery({
    queryKey: ["vote-reactions", slug],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      try {
        return await listReactions({ data: { slug } });
      } catch {
        return [];
      }
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const prev = getLocalVote(slug);
    if (prev) setVoted(prev as VoteChoice);
  }, [slug]);

  const isCreator = !!creatorView;
  const session: PublicVoteSession | null = data && data.ok === true ? data : null;
  const reactionEnabled = reactionOverride ?? session?.reactionEnabled ?? false;
  /** Reaction-only links skip the yes/no vote entirely. */
  const voteEnabled = session?.voteEnabled !== false;
  const tally = live?.tally ?? creatorView?.tally ?? session?.tally ?? { yes: 0, no: 0, a: 0, b: 0 };
  const total = live?.total ?? creatorView?.total ?? session?.total ?? 0;
  const isProfileOpen = creatorView?.isProfileOpen ?? live?.isProfileOpen ?? session?.isProfileOpen ?? false;
  const voters: VoterEntry[] = creatorView?.voters ?? live?.voters ?? session?.voters ?? [];
  const pct = (c: VoteChoice) => (total > 0 ? Math.round((tally[c] / total) * 100) : 0);
  const showResults = voted !== null || isCreator;
  const showVoterChoices = isCreator || (isProfileOpen && voted !== null);

  const headline = useMemo(() => {
    if (!session) return "";
    return session.type === "yes_no" ? `${pct("yes")}% would get it` : `A ${pct("a")}% · B ${pct("b")}%`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tally, total]);

  async function vote(choice: VoteChoice) {
    setBusy(true);
    setError(null);
    try {
      const res = await castVote({
        data: { slug, choice, displayName: name || null, deviceId: getDeviceId() || null },
      });
      const final = res.yourChoice ?? choice;
      setVoted(final);
      setLocalVote(slug, final);
      setLive({ tally: res.tally, total: res.total, voters: res.voters, isProfileOpen: res.isProfileOpen });
      if (res.alreadyVoted && res.yourChoice !== choice) {
        setError("You already voted in this poll from this device.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function shareResult() {
    if (!session) return;
    setSharing(true);
    try {
      const bars =
        session.type === "yes_no"
          ? [
              { label: "Yes", pct: pct("yes") },
              { label: "No", pct: pct("no") },
            ]
          : [
              { label: "A", pct: pct("a") },
              { label: "B", pct: pct("b") },
            ];
      const blob = await renderVoteSummary({
        caption: session.caption || "Should I get this?",
        headline,
        subline: `${total} ${total === 1 ? "vote" : "votes"}`,
        bars,
        total,
        imageUrls: [
          session.mediaTypeA === "video" ? null : session.imageUrlA,
          session.mediaTypeB === "video" ? null : session.imageUrlB,
        ].filter((u): u is string => !!u),
      });
      if (!blob) return;
      const file = new File([blob], `inksimulator-vote-${slug}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* share cancelled */
    } finally {
      setSharing(false);
    }
  }

  async function toggleProfileOpen(next: boolean) {
    try {
      await setVoteProfileOpen({ data: { slug, isProfileOpen: next } });
      await refetchCreator();
    } catch {
      setError("Could not save the setting.");
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm text-muted-foreground">Loading the poll…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Couldn't open the poll</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data?.ok === false && data.reason === "expired"
            ? "This link has expired."
            : "This link is invalid or has been removed."}
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Try your own tattoo →</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
        {session.caption ||
          (!voteEnabled
            ? "Look at my new tattoo"
            : session.type === "yes_no"
              ? "Should I get this?"
              : "Which placement looks better?")}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {voteEnabled
          ? `${total} ${total === 1 ? "vote" : "votes"}`
          : "Film your reaction and send it back — no voting here."}
      </p>

      {!voteEnabled ? (
        <div className="mt-8">
          <VoteMedia
            src={session.imageUrlA}
            isVideo={session.mediaTypeA === "video"}
            alt="Tattoo design"
            className="w-full rounded-xl border border-border object-cover"
          />
        </div>
      ) : session.type === "a_b" ? (
        <div className="mt-8 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
          {(["a", "b"] as const).map((key) => (
            <div
              key={key}
              className={`w-[78%] shrink-0 snap-center overflow-hidden rounded-xl border bg-card sm:w-auto ${
                voted === key ? "border-primary ring-2 ring-primary/40" : "border-border"
              }`}
            >
              <VoteMedia
                src={key === "a" ? session.imageUrlA : (session.imageUrlB ?? session.imageUrlA)}
                isVideo={
                  (key === "a" ? session.mediaTypeA : session.mediaTypeB) === "video"
                }
                alt={`Tattoo design ${key.toUpperCase()}`}
                className="aspect-square w-full object-cover"
              />
              <div className="p-3">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={busy || voted !== null}
                  variant={voted === key ? "default" : "outline"}
                  onClick={() => vote(key)}
                >
                  {key.toUpperCase()}
                  {showResults && ` · ${pct(key)}%`}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <VoteMedia
            src={session.imageUrlA}
            isVideo={session.mediaTypeA === "video"}
            alt="Tattoo design"
            className="w-full rounded-xl border border-border object-cover"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-16 text-base"
              disabled={busy || voted !== null}
              onClick={() => vote("yes")}
              variant={voted === "yes" ? "default" : "outline"}
            >
              <Check className="mr-2 h-5 w-5" /> YES{showResults && ` · ${pct("yes")}%`}
            </Button>
            <Button
              size="lg"
              className="h-16 text-base"
              disabled={busy || voted !== null}
              onClick={() => vote("no")}
              variant={voted === "no" ? "default" : "outline"}
            >
              <X className="mr-2 h-5 w-5" /> NO{showResults && ` · ${pct("no")}%`}
            </Button>
          </div>
        </div>
      )}

      {voteEnabled && voted === null && !isCreator && (
        <div className="mt-6">
          <label htmlFor="voter-name" className="text-xs text-muted-foreground">
            Your name (optional – otherwise you'll show as "Anonymous")
          </label>
          <Input
            id="voter-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anonymous"
            maxLength={60}
            className="mt-1"
          />
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

      {voteEnabled && voted !== null && (
        <section className="mt-8 rounded-2xl border border-primary/40 bg-card/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">Thanks for voting!</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{headline}</p>
          <div className="mt-5 flex items-center justify-center gap-2 text-lg font-semibold tracking-widest text-foreground">
            <Sparkles className="h-5 w-5 text-primary" /> INKSIMULATOR
          </div>
          <Button asChild size="lg" className="mt-4 h-14 w-full text-base">
            <Link to="/">Try yours →</Link>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Try the tattoo on your own body in AR – free, right in your browser.
          </p>
        </section>
      )}

      {!voteEnabled && !isCreator && reactionEnabled && (
        <div className="mt-6">
          <label htmlFor="reactor-name" className="text-xs text-muted-foreground">
            Your name (optional)
          </label>
          <Input
            id="reactor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anonymous"
            maxLength={60}
            className="mt-1"
          />
        </div>
      )}

      {(voteEnabled ? voted !== null : true) && reactionEnabled && !isCreator && (
        <section className="mt-6">
          <ReactionRecorder slug={slug} choice={voted} reactorName={name || null} />
        </section>
      )}

      {isCreator && (reactions?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Reactions ({reactions!.length})
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {reactions!.map((r) => (
              <figure key={r.id} className="rounded-xl overflow-hidden border border-border bg-card/50">
                {r.mediaType.startsWith("image/") ? (
                  <img src={r.url} alt="Reaction" className="w-full aspect-[3/4] object-cover" />
                ) : (
                  <video src={r.url} controls playsInline className="w-full aspect-[3/4] object-cover" />
                )}
                <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                  <span className="truncate text-muted-foreground">
                    {r.reactorName || "Anonymous"}
                    {r.choice ? ` · ${CHOICE_LABEL[r.choice as VoteChoice]}` : ""}
                  </span>
                  <button
                    onClick={async () => {
                      await deleteReaction({ data: { id: r.id } });
                      void refetchReactions();
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete reaction"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {voteEnabled && showResults && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Results</h2>
            <Button variant="outline" size="sm" onClick={shareResult} disabled={sharing}>
              {sharing ? (
                <Download className="mr-2 h-4 w-4 animate-pulse" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              Share results
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {(session.type === "yes_no" ? (["yes", "no"] as const) : (["a", "b"] as const)).map((c) => (
              <div key={c}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{CHOICE_LABEL[c]}</span>
                  <span>
                    {pct(c)}% ({tally[c]})
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct(c)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {isCreator && (
            <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-2">
                {isProfileOpen ? (
                  <Unlock className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Open profile</p>
                  <p className="text-xs text-muted-foreground">
                    {isProfileOpen
                      ? "Everyone who voted can see who voted for what."
                      : "Only aggregated stats are shown to voters."}
                  </p>
                </div>
              </div>
              <Switch checked={isProfileOpen} onCheckedChange={toggleProfileOpen} />
            </div>
          )}

          {isCreator && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Reaction cam</p>
                  <p className="text-xs text-muted-foreground">
                    {reactionEnabled
                      ? "Voters are asked — with their consent — to film a short reaction."
                      : "Off: voters are never asked for camera access."}
                  </p>
                </div>
              </div>
              <Switch
                checked={reactionEnabled}
                onCheckedChange={async (next) => {
                  setReactionOverride(next);
                  try {
                    await setVoteReactionEnabled({ data: { slug, reactionEnabled: next } });
                  } catch {
                    setReactionOverride(!next);
                  }
                }}
              />
            </div>
          )}

          <ul className="mt-5 space-y-2">
            {voters.length === 0 && <li className="text-sm text-muted-foreground">No votes yet.</li>}
            {voters.map((v, i) => (
              <li key={`${v.createdAt}-${i}`} className="flex items-center gap-3 rounded-lg bg-card/50 px-3 py-2">
                {v.avatarUrl ? (
                  <img src={v.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    {v.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="flex-1 truncate text-sm text-foreground">{v.displayName}</span>
                {showVoterChoices && v.choice && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {CHOICE_LABEL[v.choice]}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!showVoterChoices && voters.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              The creator chose private mode – only aggregated stats are shown.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

/** Renders a vote option — a still image or a looping video clip. */
function VoteMedia({
  src,
  isVideo,
  alt,
  className,
}: {
  src: string;
  isVideo: boolean;
  alt: string;
  className?: string;
}) {
  if (isVideo) {
    return (
      <video
        src={src}
        className={className}
        controls
        playsInline
        loop
        muted
        preload="metadata"
        aria-label={alt}
      />
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
