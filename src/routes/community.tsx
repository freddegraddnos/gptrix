import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { Heart, MessageCircle, Send, Trash2, Sparkles, X, Ruler, UserPlus, UserCheck, MessageSquare, Search, Camera, Lock, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";
import { useFeed, useComments, createPost, incrementPostTry, type FeedPost } from "@/hooks/useCommunity";
import { useProjects, type SavedProject } from "@/hooks/useProjects";
import { useFollow, useFollowingIds } from "@/hooks/useFollow";
import { openDirectConversation } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { listMyMotifs, subscribeMyMotifs, type MyMotif } from "@/lib/myMotifs";
import { STYLES } from "@/lib/tattoos";
import { InkWatermark } from "@/components/InkWatermark";
import { ArtistFinder } from "@/components/ArtistFinder";
import { Store, Film, Ghost } from "lucide-react";

const CATEGORIES = ["Animals", "Flowers", "Symbols", "Lettering", "Landscape", "Abstract"] as const;



export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — InkSimulator" },
      {
        name: "description",
        content:
          "Share your AR placements, get feedback, and get inspired by others' tattoo ideas in the InkSimulator Community.",
      },
      { property: "og:title", content: "InkSimulator Community" },
      {
        property: "og:description",
        content: "Feed of AR placements from tattoo enthusiasts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/community" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/community" }],
  }),
  component: CommunityPage,
});

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-US");
}

function CommunityPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"all" | "following">("all");
  const followingIds = useFollowingIds(user?.id);
  const { posts, loading, refresh, toggleLike, remove } = useFeed(user?.id, {
    mode,
    followingIds,
  });
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("All");
  /** Feed of shared placements, or find and contact a studio without a photo. */
  const [tab, setTab] = useState<"feed" | "studios">("feed");

  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const matchesFilter =
        filter === "All" || p.style === filter || p.category === filter;
      if (!matchesFilter) return false;
      if (!q) return true;
      return [p.caption, p.tattoo_name, p.body_part, p.style, p.category, p.author_name, p.author_handle]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [posts, query, filter]);


  /** Signed-out visitors can still browse and contact studios; the feed needs an account. */
  // Auth is only known in the browser, so the first render must match the SSR
  // markup — otherwise React throws a hydration mismatch here.
  const hydrated = useHydrated();
  const signedOut = hydrated && !authLoading && !user;
  const activeTab = signedOut ? "studios" : tab;

  return (
    <AppShell>
      <TopBar title="Feed" />
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl">Community</h1>
        </div>
        {activeTab === "feed" && (
          <button
            onClick={() => setComposerOpen(true)}
            className="h-10 px-4 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest flex items-center gap-1.5"
          >
            <Sparkles className="size-4" />
            Share
          </button>
        )}
      </header>

      <h2 className="sr-only">Community sections</h2>
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate p-1 text-xs font-bold uppercase tracking-widest">
        <button
          onClick={() => (signedOut ? navigate({ to: "/auth" }) : setTab("feed"))}
          aria-pressed={activeTab === "feed"}
          className={`h-10 rounded-lg transition ${
            activeTab === "feed" ? "bg-accent text-ink" : "text-muted-foreground"
          }`}
        >
          Feed
        </button>
        <button
          onClick={() => setTab("studios")}
          aria-pressed={activeTab === "studios"}
          className={`h-10 rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === "studios" ? "bg-accent text-ink" : "text-muted-foreground"
          }`}
        >
          <Store className="size-4" />
          Studios
        </button>
      </div>

      {activeTab === "feed" && <FunSection />}

      {activeTab === "studios" && <StudiosTab />}

      {activeTab === "feed" && (
       <>
      <h2 className="sr-only">Filter the feed</h2>
      <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 p-1 text-xs font-bold uppercase tracking-widest">
        <button
          onClick={() => setMode("all")}
          className={`h-9 rounded-lg transition ${
            mode === "all" ? "bg-accent text-ink" : "text-muted-foreground"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setMode("following")}
          className={`h-9 rounded-lg transition ${
            mode === "following" ? "bg-accent text-ink" : "text-muted-foreground"
          }`}
        >
          Following
        </button>
      </div>

      <div className="mb-3 relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search designs, styles or people…"
          aria-label="Search the feed"
          className="w-full h-11 rounded-xl bg-slate border border-white/10 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="mb-5 -mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar">
        {(["All", ...STYLES, ...CATEGORIES] as string[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-bold uppercase tracking-widest transition ${
              filter === s
                ? "bg-accent text-ink"
                : "bg-slate border border-white/10 text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>



      <h2 className="sr-only">
        {mode === "following" ? "Posts from people you follow" : "Latest AR placements"}
      </h2>
      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-10">
          Loading feed…
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <Sparkles className="size-8 mx-auto text-muted-foreground" />
          {posts.length > 0 ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                No designs match your search.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setFilter("All");
                }}
                className="mt-4 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {mode === "following"
                  ? "Follow users to see their posts here."
                  : "Be the first to share an AR placement."}
              </p>
              {mode === "all" && (
                <button
                  onClick={() => setComposerOpen(true)}
                  className="mt-4 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
                >
                  Share your first project
                </button>
              )}
              {mode === "following" && (
                <button
                  onClick={() => setMode("all")}
                  className="mt-4 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
                >
                  Explore all
                </button>
              )}
            </>
          )}
        </div>

      ) : (
        <ul className="space-y-6">
          {visiblePosts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              currentUserId={user?.id}
              isMine={user?.id === p.user_id}
              onLike={() => toggleLike(p.id)}
              onComment={() => setOpenComments(p.id)}
              onDelete={() => remove(p.id)}
            />
          ))}
        </ul>
      )}
       </>
      )}



      {openComments && user && (
        <CommentsSheet
          postId={openComments}
          currentUserId={user.id}
          onClose={() => {
            setOpenComments(null);
            void refresh();
          }}
        />
      )}

      {composerOpen && user && (
        <ComposerSheet
          userId={user.id}
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false);
            void refresh();
          }}
        />
      )}
    </AppShell>
  );
}

/**
 * The playful shares — before/after clip, Snapchat prank filter and the
 * countdown reveal — all live here now instead of the Designs library and the
 * More menu.
 */
function FunSection() {
  const items = [
    {
      to: "/before-after" as const,
      title: "Before / after video",
      text: "A 9:16 clip for TikTok and Reels: no tattoo, then the realistic result.",
      icon: Film,
    },
    {
      to: "/snapchat" as const,
      title: "Prank reactions",
      text: "Send a design into Snapchat as a sticker and film the reaction.",
      icon: Ghost,
    },
    {
      to: "/reveal" as const,
      title: "Tattoo reveal",
      text: "A 3-2-1 countdown and reveal animation, recorded automatically.",
      icon: Sparkles,
    },
  ];

  return (
    <section className="mb-6">
      <h2 className="font-display font-bold text-lg">Fun</h2>
      <ul className="mt-3 space-y-3">
        {items.map(({ to, title, text, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-2xl border border-white/12 bg-slate/60 p-4 active:scale-[0.99] transition"
            >
              <span className="size-11 shrink-0 rounded-xl bg-white/10 grid place-items-center">
                <Icon className="size-5 text-accent" strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-bold text-[15px]">{title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {text}
                </span>
              </span>
              <span className="text-accent text-lg" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Find a studio and get in touch without taking a photo first: search by name
 * or city, filter by distance and style, then message the studio or send a
 * booking request straight from the card.
 */
function StudiosTab() {
  const [q, setQ] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <section>
      <h2 className="font-display font-bold text-lg">Find a studio</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Search studios and send a message or a booking request — no photo
        needed.
      </p>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Studio name or city"
          aria-label="Search studios"
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent"
        />
      </div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className={`h-9 px-3 rounded-xl border text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${
            filtersOpen ? "border-accent/60 text-accent" : "border-white/15 text-foreground/80"
          }`}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
        </button>
      </div>
      <ArtistFinder
        q={q}
        onQChange={setQ}
        filtersOpen={filtersOpen}
        coords={coords}
        geoBusy={geoBusy}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        onUseLocation={() => {
          if (!navigator.geolocation) return;
          setGeoBusy(true);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setGeoBusy(false);
            },
            () => setGeoBusy(false),
            { enableHighAccuracy: false, timeout: 8000 },
          );
        }}
      />
    </section>
  );
}

function PostCard({
  post,
  currentUserId,
  isMine,
  onLike,
  onComment,
  onDelete,
}: {
  post: FeedPost;
  currentUserId: string | undefined;
  isMine: boolean;
  onLike: () => void;
  onComment: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const { following, toggle } = useFollow(currentUserId, isMine ? undefined : post.user_id);
  const [dmBusy, setDmBusy] = useState(false);
  const [tryBusy, setTryBusy] = useState(false);
  const paid = post.price_ore > 0;

  const openDm = async () => {
    if (!currentUserId || isMine) return;
    setDmBusy(true);
    try {
      const id = await openDirectConversation(currentUserId, post.user_id);
      navigate({ to: "/messages/$id", params: { id } });
    } finally {
      setDmBusy(false);
    }
  };

  /** One tap from the feed into the AR camera with this design loaded. */
  const tryInAr = async () => {
    if (!post.image_url || paid) return;
    setTryBusy(true);
    try {
      const blob = await (await fetch(post.image_url)).blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      sessionStorage.setItem("inkvision.generated.motif", dataUrl);
      void incrementPostTry(post.id);
      navigate({ to: "/ar", search: { motif: "generated" } as never });
    } catch {
      setTryBusy(false);
    }
  };


  return (
    <li className="rounded-2xl overflow-hidden border border-white/10 bg-slate">
      <div className="flex items-center gap-2.5 p-3">
        <div className="size-9 rounded-full bg-ink border border-white/10 overflow-hidden grid place-items-center">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-accent">
              {(post.author_name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {post.author_handle ? (
            <Link
              to="/u/$handle"
              params={{ handle: post.author_handle }}
              className="text-sm font-bold truncate block hover:text-accent"
            >
              {post.author_name ?? `@${post.author_handle}`}
            </Link>
          ) : (
            <div className="text-sm font-bold truncate">
              {post.author_name ?? "Anonymous"}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground truncate">
            {post.author_handle ? `@${post.author_handle} · ` : ""}
            {timeAgo(post.created_at)}
            {post.body_part && ` · ${post.body_part}`}
          </div>
        </div>

        {isMine ? (
          <button
            onClick={onDelete}
            aria-label="Delete"
            className="size-8 rounded-lg text-muted-foreground hover:text-destructive grid place-items-center"
          >
            <Trash2 className="size-4" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={openDm}
              disabled={dmBusy}
              aria-label="Send message"
              className="size-9 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground grid place-items-center disabled:opacity-50"
            >
              <MessageSquare className="size-4" />
            </button>
            <button
              onClick={toggle}
              className={`h-9 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${
                following
                  ? "border border-white/10 text-muted-foreground"
                  : "bg-accent text-ink"
              }`}
            >
              {following ? (
                <>
                  <UserCheck className="size-3" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="size-3" />
                  Follow
                </>
              )}
            </button>
          </div>
        )}
      </div>


      <div className="relative aspect-square bg-ink">
        {post.image_url ? (
          <img
            src={post.image_url}
            alt={post.caption ?? "AR placement"}
            draggable={!paid}
            onContextMenu={(e) => paid && e.preventDefault()}
            className={`w-full h-full object-cover ${paid ? "select-none" : ""}`}
          />
        ) : null}
        {paid && <InkWatermark />}
      </div>


      <div className="p-3">
        <div className="flex items-center gap-4">
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 text-sm font-bold ${
              post.liked_by_me ? "text-accent" : "text-foreground"
            }`}
          >
            <Heart
              className="size-5"
              fill={post.liked_by_me ? "currentColor" : "none"}
              strokeWidth={post.liked_by_me ? 0 : 2}
            />
            {post.likes}
          </button>
          <button
            onClick={onComment}
            className="flex items-center gap-1.5 text-sm font-bold"
          >
            <MessageCircle className="size-5" />
            {post.comments}
          </button>
          {paid ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent/40 px-2.5 h-7 text-[10px] font-bold uppercase tracking-widest text-accent">
              <Lock className="size-3" />
              {(post.price_ore / 100).toFixed(0)} kr
            </span>
          ) : (
            <button
              onClick={tryInAr}
              disabled={tryBusy || !post.image_url}
              className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent text-ink text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
            >
              <Camera className="size-3.5" />
              {tryBusy ? "Opening…" : "Try in AR"}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          {post.category && (
            <span className="rounded-full bg-ink border border-white/10 px-2 py-0.5">
              {post.category}
            </span>
          )}
          {post.style && (
            <span className="rounded-full bg-ink border border-white/10 px-2 py-0.5">
              {post.style}
            </span>
          )}
          <span>{post.try_count} tries</span>
          {post.tattoo_name && (
            <span className="flex items-center gap-1">
              <Ruler className="size-3" />
              {post.tattoo_name}
            </span>
          )}
        </div>
        {post.caption && (
          <p className="mt-2 text-sm leading-snug whitespace-pre-wrap">
            {post.caption}
          </p>
        )}

      </div>
    </li>
  );
}

function CommentsSheet({
  postId,
  currentUserId,
  onClose,
}: {
  postId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const { comments, add, loading } = useComments(postId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await add(currentUserId, text);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md bg-ink border-t sm:border sm:rounded-2xl border-white/10 flex flex-col max-h-[85vh]">
        <header className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-bold text-sm uppercase tracking-widest">
            Comments
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="size-8 grid place-items-center rounded-lg text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center">
              Write the first comment.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <div className="size-8 shrink-0 rounded-full bg-slate border border-white/10 overflow-hidden grid place-items-center">
                  {c.author_avatar ? (
                    <img src={c.author_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-accent">
                      {(c.author_name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <span className="font-bold">
                      {c.author_name ?? "Anonymous"}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Write a comment…"
            maxLength={500}
            className="flex-1 h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || sending}
            className="h-11 w-11 rounded-xl bg-accent text-ink grid place-items-center disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposerSheet({
  userId,
  onClose,
  onPosted,
}: {
  userId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const { projects } = useProjects(userId);
  const [source, setSource] = useState<"projects" | "designs">("projects");
  const [selected, setSelected] = useState<SavedProject | null>(null);
  const [selectedMotif, setSelectedMotif] = useState<MyMotif | null>(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  const [style, setStyle] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myMotifs, setMyMotifs] = useState<MyMotif[]>([]);

  useEffect(() => {
    setMyMotifs(listMyMotifs());
    return subscribeMyMotifs(() => setMyMotifs(listMyMotifs()));
  }, []);

  const eligible = useMemo(
    () => projects.filter((p) => !!p.preview_url),
    [projects],
  );

  const canPublish =
    source === "projects" ? !!selected?.preview_url : !!selectedMotif;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (source === "designs") {
        if (!selectedMotif) return;
        await createPost({
          userId,
          imageDataUrl: selectedMotif.src,
          caption,
          tattooName: selectedMotif.name,
          category: category || null,
          style: style || null,
          priceOre: price ? Math.round(Number(price) * 100) : 0,
        });
      } else {
        if (!selected?.preview_url) return;
        // Fetch preview (signed URL from private bucket) and re-upload to community
        const res = await fetch(selected.preview_url);
        if (!res.ok) throw new Error("Could not read preview");
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        await createPost({
          userId,
          imageDataUrl: dataUrl,
          caption,
          bodyPart: selected.body_part ?? undefined,
          tattooName:
            selected.width_cm != null
              ? `${selected.width_cm} cm${selected.tattoo_name ? " · " + selected.tattoo_name : ""}`
              : selected.tattoo_name ?? undefined,
          category: category || null,
          style: style || null,
          priceOre: price ? Math.round(Number(price) * 100) : 0,
        });
      }
      // Ensure user has a profile row (fallback if trigger missed)
      await supabase
        .from("profiles")
        .upsert({ id: userId }, { onConflict: "id" });
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  const empty =
    source === "projects" ? eligible.length === 0 : myMotifs.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md bg-ink border-t sm:border sm:rounded-2xl border-white/10 flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-bold text-sm uppercase tracking-widest">
            Share to feed
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="size-8 grid place-items-center rounded-lg text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex gap-2 px-4 pt-4">
          {(["projects", "designs"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`h-9 px-4 rounded-full text-xs font-bold uppercase tracking-widest transition ${
                source === s
                  ? "bg-accent text-ink"
                  : "bg-slate border border-white/10 text-muted-foreground"
              }`}
            >
              {s === "projects" ? "AR projects" : "My designs"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {empty ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                {source === "projects"
                  ? "You have no saved projects with a preview."
                  : "You have no own designs yet — upload one or create one with AI or text."}
              </p>
              <Link
                to={source === "projects" ? "/ar" : "/library"}
                className="mt-4 inline-flex h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm items-center justify-center"
              >
                {source === "projects" ? "Create in the AR camera" : "Create a design"}
              </Link>
            </div>
          ) : (
            <>
              <div>
                <div className="text-mono-caps text-[10px] text-muted-foreground mb-2">
                  {source === "projects" ? "Choose project" : "Choose design"}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {source === "projects"
                    ? eligible.map((p) => {
                        const active = selected?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelected(p)}
                            aria-pressed={active}
                            className={`aspect-square rounded-xl overflow-hidden border-2 transition ${
                              active ? "border-accent" : "border-white/10"
                            }`}
                          >
                            <img
                              src={p.preview_url!}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        );
                      })
                    : myMotifs.map((m) => {
                        const active = selectedMotif?.id === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedMotif(m)}
                            aria-pressed={active}
                            className={`aspect-square rounded-xl overflow-hidden bg-slate border-2 transition ${
                              active ? "border-accent" : "border-white/10"
                            }`}
                          >
                            <img
                              src={m.src}
                              alt={m.name}
                              className="w-full h-full object-contain p-2"
                            />
                          </button>
                        );
                      })}
                </div>
              </div>
              <div>
                <div className="text-mono-caps text-[10px] text-muted-foreground mb-2">
                  Caption (optional)
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                  placeholder="Tell us about the placement, motif or what you're wondering about…"
                  rows={4}
                  className="w-full rounded-xl bg-slate border border-white/10 px-3 py-2 text-sm outline-none focus:border-accent resize-none"
                />
                <div className="mt-1 text-right text-[10px] text-muted-foreground">
                  {caption.length}/500
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-mono-caps text-[10px] text-muted-foreground">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
                  >
                    <option value="">—</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-mono-caps text-[10px] text-muted-foreground">Style</span>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
                  >
                    <option value="">—</option>
                    {STYLES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-mono-caps text-[10px] text-muted-foreground">
                  Price in kr (leave empty for free)
                </span>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="0"
                  className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  Priced designs get the InkSimulator watermark and can't be downloaded or tried on by others.
                </span>
              </label>

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </>
          )}
        </div>
        {!empty && (
          <div className="p-4 border-t border-white/10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              onClick={submit}
              disabled={!canPublish || busy}
              className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm uppercase tracking-widest disabled:opacity-50"
            >
              {busy ? "Publishing…" : "Publish to feed"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

