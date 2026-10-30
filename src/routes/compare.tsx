import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Check,
  ImageIcon,
  Ruler,
  X,
  GitCompareArrows,
  Vote,
  Copy,
  Share2,
  Images,
  Download,
} from "lucide-react";
import { createVoteSession } from "@/lib/votes.functions";
import {
  canShareFiles,
  composeAbCard,
  downloadBlobFile,
  urlToBlob,
} from "@/lib/abCompareCard";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, type SavedProject } from "@/hooks/useProjects";
import { markFlag } from "@/hooks/useJourney";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare placements — InkSimulator" },
      {
        name: "description",
        content:
          "Put your saved AR placements side by side and pick the one that feels best.",
      },
      { property: "og:title", content: "Compare AR placements" },
      {
        property: "og:description",
        content: "Up to 4 saved projects side by side.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ComparePage,
});

/** Reads a saved preview (signed URL) into a base64 data URL for the vote upload. */
async function toDataUrl(url: string | null): Promise<string> {
  if (!url) throw new Error("One of the selected projects has no image.");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not read the saved image.");
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the saved image."));
    reader.readAsDataURL(blob);
  });
}

function ComparePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { projects } = useProjects(user?.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [voteBusy, setVoteBusy] = useState(false);
  const [voteLink, setVoteLink] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareBusy, setShareBusy] = useState<"card" | "both" | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/compare" } });
    markFlag("compare");
  }, [loading, user, navigate]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const chosen = useMemo(
    () =>
      selected
        .map((id) => projects.find((p) => p.id === id))
        .filter((p): p is SavedProject => !!p),
    [selected, projects],
  );

  const startVote = async () => {
    if (chosen.length !== 2) return;
    setVoteBusy(true);
    setVoteError(null);
    setVoteLink(null);
    try {
      const [a, b] = await Promise.all(chosen.map((p) => toDataUrl(p.preview_url)));
      const res = await createVoteSession({
        data: {
          type: "a_b",
          caption: `${chosen[0]!.name} or ${chosen[1]!.name}?`,
          imageA: { dataUrl: a },
          imageB: { dataUrl: b },
          origin: window.location.origin,
        },
      });
      setVoteLink(res.url);
    } catch (err) {
      setVoteError(
        err instanceof Error ? err.message : "Could not create the vote link.",
      );
    } finally {
      setVoteBusy(false);
    }
  };

  const shareVote = async () => {
    if (!voteLink) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Option 1 or 2?",
          text: "Which one should I get?",
          url: voteLink,
        });
      } else {
        await navigator.clipboard.writeText(voteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      /* cancelled */
    }
  };

  /** Shares one composed "1 vs 2" card image (both photos in one picture). */
  const shareAbCard = async () => {
    if (chosen.length !== 2) return;
    setShareBusy("card");
    setVoteError(null);
    try {
      const [ua, ub] = chosen.map((p) => p.preview_url);
      if (!ua || !ub) throw new Error("One of the selected projects has no image.");
      const blob = await composeAbCard(ua, ub, {
        caption: "1 or 2?",
      });
      const file = new File([blob], "inksimulator-1-or-2.jpg", { type: blob.type });
      const text = voteLink
        ? `Which one should I get – 1 or 2? Vote: ${voteLink}`
        : "Which one should I get – 1 or 2?";
      if (canShareFiles([file])) {
        await navigator.share({ files: [file], title: "1 or 2?", text });
      } else {
        downloadBlobFile(blob, file.name);
        setShareNote("Saved the card to your device – attach it in the app you want.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setVoteError(
          err instanceof Error ? err.message : "Could not share the images.",
        );
      }
    } finally {
      setShareBusy(null);
    }
  };

  /** Shares both photos as two separate files in one share sheet. */
  const shareBothPhotos = async () => {
    if (chosen.length !== 2) return;
    setShareBusy("both");
    setVoteError(null);
    try {
      const [ua, ub] = chosen.map((p) => p.preview_url);
      if (!ua || !ub) throw new Error("One of the selected projects has no image.");
      const [ba, bb] = await Promise.all([urlToBlob(ua), urlToBlob(ub)]);
      const files = [
        new File([ba], "option-1.jpg", { type: ba.type || "image/jpeg" }),
        new File([bb], "option-2.jpg", { type: bb.type || "image/jpeg" }),
      ];
      const text = voteLink
        ? `Option 1 or option 2? Vote: ${voteLink}`
        : "Option 1 or option 2?";
      if (canShareFiles(files)) {
        await navigator.share({ files, title: "Option 1 or 2?", text });
      } else {
        files.forEach((f) => downloadBlobFile(f, f.name));
        setShareNote("Saved both photos to your device – send them together manually.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setVoteError(
          err instanceof Error ? err.message : "Could not share the images.",
        );
      }
    } finally {
      setShareBusy(null);
    }
  };


  if (projects.length === 0) {
    return (
      <AppShell>
        <header className="mb-6">
          <div className="flex items-center gap-2 text-mono-caps text-[10px] text-accent">
            <GitCompareArrows className="size-3" />
            Compare
          </div>
          <h1 className="mt-1 font-display font-bold text-2xl">Side by side</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <ImageIcon className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            You need at least two saved projects to compare.
          </p>
          <Link
            to="/ar"
            className="mt-4 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
          >
            Open camera
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-4">
        <div className="flex items-center gap-2 text-mono-caps text-[10px] text-accent">
          <GitCompareArrows className="size-3" />
          Compare placements
        </div>
        <h1 className="mt-1 font-display font-bold text-2xl">Side by side</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose 2–4 projects to compare them against each other.
        </p>
      </header>

      {chosen.length >= 2 && (
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/5 p-2">
          <div
            className={`grid gap-2 ${
              chosen.length === 2
                ? "grid-cols-2"
                : chosen.length === 3
                  ? "grid-cols-3"
                  : "grid-cols-2"
            }`}
          >
            {chosen.map((p) => (
              <div
                key={p.id}
                className="rounded-xl overflow-hidden border border-white/10 bg-ink"
              >
                <div className="aspect-square bg-ink grid place-items-center">
                  {p.preview_url ? (
                    <img
                      src={p.preview_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[11px] font-bold truncate">{p.name}</div>
                  <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-0.5">
                    {p.width_cm != null && (
                      <span className="flex items-center gap-0.5">
                        <Ruler className="size-2.5" />
                        {p.width_cm}cm
                      </span>
                    )}
                    {p.body_part && <span className="truncate">{p.body_part}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[10px] text-muted-foreground">
              {chosen.length} selected · max 4
            </span>
            <button
              onClick={() => setSelected([])}
              className="text-[10px] text-accent font-bold uppercase tracking-widest flex items-center gap-1"
            >
              <X className="size-3" />
              Clear
            </button>
          </div>

          {chosen.length === 2 && (
            <div className="mt-2 border-t border-white/10 pt-2">
              <button
                onClick={startVote}
                disabled={voteBusy}
                className="h-11 w-full rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Vote className="size-4" />
                {voteBusy ? "Creating link…" : "Let friends vote: 1 or 2"}
              </button>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={shareAbCard}
                  disabled={shareBusy !== null}
                  className="h-10 rounded-xl border border-accent/40 bg-accent/10 text-foreground font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Share2 className="size-3.5" />
                  {shareBusy === "card" ? "Preparing…" : "Share 1 vs 2 card"}
                </button>
                <button
                  onClick={shareBothPhotos}
                  disabled={shareBusy !== null}
                  className="h-10 rounded-xl border border-white/15 text-foreground font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Images className="size-3.5" />
                  {shareBusy === "both" ? "Preparing…" : "Share both photos"}
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
                Both options go out together so friends can answer 1 or 2. The
                vote link above records the answers.
              </p>
              {shareNote && (
                <p className="mt-1.5 px-1 text-[10px] text-accent flex items-center gap-1">
                  <Download className="size-3" />
                  {shareNote}
                </p>
              )}
              {voteError && (
                <p className="mt-2 text-[11px] text-red-400">{voteError}</p>
              )}
              {voteLink && (
                <div className="mt-2 space-y-2">
                  <div className="h-10 rounded-xl bg-ink border border-white/10 px-3 flex items-center text-[11px] text-muted-foreground truncate">
                    {voteLink}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={shareVote}
                      className="h-10 rounded-xl bg-accent text-ink font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="size-3.5" />
                      Share
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(voteLink);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1600);
                      }}
                      className="h-10 rounded-xl border border-white/15 text-foreground font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <Link
                      to="/vote-results/$slug"
                      params={{ slug: voteLink.split("/").pop()! }}
                      className="h-10 rounded-xl border border-white/15 text-foreground font-bold text-[11px] uppercase tracking-widest flex items-center justify-center"
                    >
                      Results
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-mono-caps text-[10px] text-muted-foreground mb-2">
        Your projects
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {projects.map((p) => {
          const isSel = selected.includes(p.id);
          const disabled = !isSel && selected.length >= 4;
          return (
            <li key={p.id}>
              <button
                onClick={() => toggle(p.id)}
                disabled={disabled}
                className={`w-full rounded-xl overflow-hidden border relative transition-all active:scale-95 ${
                  isSel
                    ? "border-accent ring-2 ring-accent/50"
                    : "border-white/10"
                } ${disabled ? "opacity-40" : ""}`}
              >
                <div className="aspect-square bg-slate grid place-items-center">
                  {p.preview_url ? (
                    <img
                      src={p.preview_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </div>
                {isSel && (
                  <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-accent text-ink grid place-items-center">
                    <Check className="size-3" strokeWidth={3} />
                  </div>
                )}
                <div className="px-2 py-1 text-left">
                  <div className="text-[10px] font-bold truncate">{p.name}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
