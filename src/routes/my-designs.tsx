/**
 * Client panel: everything the user owns — purchased gallery designs, their
 * own drawings, lettering and uploads — with downloads.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Trash2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { useMarketplace, formatKr } from "@/hooks/useMarketplace";
import {
  listMyMotifs,
  deleteMyMotif,
  subscribeMyMotifs,
  type MyMotif,
} from "@/lib/myMotifs";
import { syncMyMotifs } from "@/lib/myMotifsSync";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-designs")({
  head: () => ({
    meta: [
      { title: "My designs & purchases — InkSimulator" },
      {
        name: "description",
        content:
          "Your purchased tattoo designs, your own drawings and lettering — view, download or try them on in AR.",
      },
      { property: "og:title", content: "My designs & purchases — InkSimulator" },
      {
        property: "og:description",
        content: "All the tattoo designs you bought or created, saved to your account.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <MyDesignsPage />
    </RequireAuth>
  ),
});

type TabKey = "bought" | "drawings" | "lettering";

async function download(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  } catch {
    window.open(url, "_blank");
  }
}

function safeName(name: string) {
  return `${name.replace(/[^a-z0-9\-_ ]/gi, "").trim() || "design"}.png`;
}

function MyDesignsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("bought");
  const [mine, setMine] = useState<MyMotif[]>([]);
  const { motifs, loading } = useMarketplace(user?.id);

  useEffect(() => {
    const refresh = () => setMine(listMyMotifs());
    refresh();
    return subscribeMyMotifs(refresh);
  }, []);

  useEffect(() => {
    void syncMyMotifs(user?.id);
  }, [user?.id]);

  const bought = useMemo(
    () => motifs.filter((m) => m.purchased && m.image_url),
    [motifs, user?.id],
  );
  const drawings = useMemo(() => mine.filter((m) => m.source !== "text"), [mine]);
  const lettering = useMemo(() => mine.filter((m) => m.source === "text"), [mine]);

  /** Purchased designs download clean — the watermark is only for previews. */
  const downloadBought = async (imagePath: string, name: string) => {
    const { data } = await supabase.storage
      .from("marketplace")
      .createSignedUrl(imagePath, 600);
    if (data?.signedUrl) await download(data.signedUrl, safeName(name));
  };

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "bought", label: "Purchased", count: bought.length },
    { key: "drawings", label: "My drawings", count: drawings.length },
    { key: "lettering", label: "My lettering", count: lettering.length },
  ];

  const list = tab === "bought" ? [] : tab === "drawings" ? drawings : lettering;

  return (
    <AppShell>
      <header className="mb-4">
        <div className="text-mono-caps text-[10px] text-accent">Your account</div>
        <h1 className="mt-1 font-display text-2xl font-bold">My designs</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything you bought or created, saved to your account.
        </p>
      </header>

      <nav className="mb-4 grid grid-cols-3 gap-2 text-[11px] font-bold">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-10 rounded-xl border px-1 ${
              tab === t.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-white/10 text-muted-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </nav>

      {tab === "bought" ? (
        loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        ) : bought.length === 0 ? (
          <Empty
            text="No purchased designs yet."
            action={
              <Link
                to="/shop"
                className="inline-flex h-10 items-center rounded-xl border border-accent/60 px-4 text-[11px] font-bold uppercase tracking-widest text-accent"
              >
                Browse the gallery
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {bought.map((m) => (
              <li
                key={m.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate"
              >
                <div className="aspect-square bg-artwork">
                  {m.image_url && (
                    <img
                      src={m.image_url}
                      alt={m.name}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="truncate text-sm font-bold">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.price_ore > 0 ? formatKr(m.price_ore) : "Free"} ·{" "}
                    {m.artist_name ?? "Studio"}
                  </div>
                  <button
                    onClick={() => void downloadBought(m.image_path, m.name)}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-[11px] font-bold text-ink"
                  >
                    <Download className="size-3.5" /> Download
                  </button>
                  <Link
                    to="/ar"
                    search={{ motif: m.id }}
                    className="flex h-9 w-full items-center justify-center rounded-lg border border-accent/50 text-[11px] font-bold text-accent"
                  >
                    Try in AR
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <Empty
          text={
            tab === "drawings"
              ? "Nothing drawn or uploaded yet."
              : "No lettering saved yet."
          }
          action={
            <Link
              to="/rita"
              className="inline-flex h-10 items-center rounded-xl border border-accent/60 px-4 text-[11px] font-bold uppercase tracking-widest text-accent"
            >
              Open the studio
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {list.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-slate"
            >
              <div className="aspect-square bg-artwork">
                <img src={m.src} alt={m.name} className="h-full w-full object-contain" />
              </div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-bold">{m.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()} · {m.widthCm} cm
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void download(m.src, safeName(m.name))}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-[11px] font-bold text-ink"
                  >
                    <Download className="size-3.5" /> Save
                  </button>
                  <button
                    aria-label={`Delete ${m.name}`}
                    onClick={() => deleteMyMotif(m.id)}
                    className="grid size-9 place-items-center rounded-lg border border-white/15 text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function Empty({ text, action }: { text: string; action: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 p-8 text-center">
      <Sparkles className="mx-auto size-6 text-accent" />
      <p className="mt-2 text-sm font-bold">{text}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}
