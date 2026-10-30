import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Preview = {
  title: string;
  studio_name: string | null;
  artist_handle: string | null;
  base_photo_url: string | null;
  after_url: string | null;
  before_url: string | null;
  motif_url: string | null;
  notes: string | null;
  comments: {
    id: string;
    author_name: string | null;
    body: string;
    created_at: string;
  }[];
};

export const Route = createFileRoute("/p/$token")({
  head: ({ params }) => ({
    meta: [
      { title: "Tattoo Design Preview — InkSimulator" },
      {
        name: "description",
        content:
          "Preview the design your artist created in InkSimulator and leave comments.",
      },
      { property: "og:title", content: "Tattoo Design Preview — InkSimulator" },
      {
        property: "og:description",
        content: "See a before/after of your upcoming tattoo.",
      },
      { property: "og:type", content: "article" },
      {
        property: "og:url",
        content: `https://www.inksimulator.com/p/${params.token}`,
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `https://www.inksimulator.com/p/${params.token}` }],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const { token } = Route.useParams();
  const { user } = useAuth();
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data: res } = await supabase.rpc("artist_preview_by_token", {
      _token: token,
    });
    setData((res ?? null) as Preview | null);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await supabase.rpc("add_artist_preview_comment", {
        _token: token,
        _body: body.trim(),
        _name: name.trim() || "Guest",
      });
      setBody("");
      await load();
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-ink text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-dvh grid place-items-center bg-ink px-6 text-center">
        <div>
          <h1 className="font-display text-xl font-bold">This link is not valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The preview link has been removed or is incorrect.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-ink px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <p className="text-mono-caps text-[10px] text-accent">
          Preview from your artist
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">{data.title}</h1>
        <p className="text-[12px] text-muted-foreground">
          {data.studio_name}
          {data.artist_handle ? ` · @${data.artist_handle}` : ""}
        </p>

        {data.after_url || data.base_photo_url ? (
          <img
            src={(data.after_url ?? data.base_photo_url) as string}
            alt={`Preview of ${data.title}`}
            className="mt-4 w-full rounded-2xl border border-white/10"
          />
        ) : null}

        {data.before_url && data.after_url && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <figure>
              <img
                src={data.before_url}
                alt="Before"
                className="rounded-xl border border-white/10"
              />
              <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
                BEFORE
              </figcaption>
            </figure>
            <figure>
              <img
                src={data.after_url}
                alt="After"
                className="rounded-xl border border-white/10"
              />
              <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
                AFTER
              </figcaption>
            </figure>
          </div>
        )}

        {data.notes && (
          <p className="mt-4 rounded-2xl border border-white/10 bg-slate p-4 text-sm">
            {data.notes}
          </p>
        )}

        <section className="mt-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <MessageSquare className="size-4" /> Comments
          </h2>
          <ul className="mt-3 space-y-2">
            {data.comments?.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-white/10 bg-slate p-3"
              >
                <div className="text-[11px] text-muted-foreground">
                  {c.author_name || "Guest"} ·{" "}
                  {new Date(c.created_at).toLocaleDateString("en-US")}
                </div>
                <p className="mt-1 text-sm">{c.body}</p>
              </li>
            ))}
            {(!data.comments || data.comments.length === 0) && (
              <li className="text-sm text-muted-foreground">
                No comments yet — tell them what you think.
              </li>
            )}
          </ul>

          {!user && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-slate px-3 text-sm outline-none focus:border-accent"
            />
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Write a comment to your artist…"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate p-3 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !body.trim()}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-ink disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send comment
          </button>
        </section>
      </div>
    </main>
  );
}
