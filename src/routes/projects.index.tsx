import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Trash2,
  ImageIcon,
  Ruler,
  FileDown,
  Loader2,
  Sparkles,
  GitCompareArrows,
  Camera,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, type SavedProject } from "@/hooks/useProjects";
import { exportProjectPdf } from "@/lib/pdf";
import { tx, useUiLang } from "@/lib/uiLang";
import { setActiveIdea } from "@/lib/ideaContext";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "My ideas — InkSimulator" },
      {
        name: "description",
        content:
          "Your portfolio of tested AR placements — compare, export PDF, and send to your artist.",
      },
      { property: "og:title", content: "My tattoo ideas — InkSimulator" },
      {
        property: "og:description",
        content: "Tested AR placements, compare side by side, and send to a tattoo artist.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  useUiLang();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { projects, remove } = useProjects(user?.id);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/projects" } });
  }, [loading, user, navigate]);

  const downloadPdf = async (p: SavedProject) => {
    setPdfBusy(p.id);
    try {
      await exportProjectPdf(p);
    } finally {
      setPdfBusy(null);
    }
  };

  const totalCm = projects.reduce((s, p) => s + (p.width_cm ?? 0), 0);
  const latest = projects.reduce<SavedProject | null>((best, p) => {
    const t = (x: SavedProject) => (x as SavedProject & { updated_at?: string }).updated_at ?? x.created_at;
    return !best || t(p) > t(best) ? p : best;
  }, null);

  return (
    <AppShell>
      <header className="mb-5">
        <h1 className="font-display font-bold text-2xl">{tx("My ideas")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {projects.length === 0
            ? tx("Your tattoo journey starts here.")
            : `${projects.length} · ${totalCm.toFixed(0)} cm`}
        </p>
      </header>

      {latest && (
        <section aria-labelledby="continue" className="mb-5 rounded-2xl border border-accent/50 bg-slate p-3">
          <h2 id="continue" className="text-mono-caps text-[11px] text-accent">{tx("Continue where you left off")}</h2>
          <div className="mt-2 flex gap-3">
            <Link to="/projects/$id" params={{ id: latest.id }} className="size-20 shrink-0 overflow-hidden rounded-xl bg-ink grid place-items-center">
              {latest.preview_url ? <img src={latest.preview_url} alt="" className="size-full object-cover" /> : <ImageIcon className="size-6 text-muted-foreground" />}
            </Link>
            <div className="min-w-0 flex-1">
              <Link to="/projects/$id" params={{ id: latest.id }} className="block truncate text-sm font-bold">{latest.name}</Link>
              <p className="truncate text-xs text-muted-foreground">{[latest.tattoo_name, latest.width_cm != null ? `${latest.width_cm} cm` : null, latest.body_part].filter(Boolean).join(" · ")}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Link to="/projects/$id" params={{ id: latest.id }} className="h-11 rounded-lg bg-accent text-ink text-[11px] font-bold grid place-items-center">{tx("Open")}</Link>
                <Link to="/ar" search={{ motif: latest.tattoo_id ?? undefined }} className="h-11 rounded-lg border border-white/15 text-[11px] font-bold flex items-center justify-center gap-1"><Camera className="size-3.5" />AR</Link>
                <Link to="/studios" search={{ idea: latest.id }} onClick={() => setActiveIdea(latest.id)} className="h-11 rounded-lg border border-white/15 text-[11px] font-bold grid place-items-center text-center leading-tight">{tx("Find studio")}</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
        {tx("Ideas are the designs you saved, with size, placement and references. ")}
        <Link to="/history" className="underline underline-offset-2">{tx("History")}</Link>{tx(" keeps every AR test, ")}
        <Link to="/compare" className="underline underline-offset-2">{tx("Compare")}</Link>{tx(" shows ideas side by side, and your profile lookbook shows only what you choose to make public.")}
      </p>

      {projects.length >= 2 && (
        <div className="grid grid-cols-2 gap-2 mb-5">
          <Link
            to="/compare"
            className="rounded-2xl border border-white/10 bg-slate p-3 flex items-center gap-2 hover:border-accent/40 transition-colors"
          >
            <div className="size-9 rounded-lg bg-accent/10 text-accent grid place-items-center">
              <GitCompareArrows className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold">Compare</div>
              <div className="text-[10px] text-muted-foreground truncate">
                Side by side
              </div>
            </div>
          </Link>
          <Link
            to="/advisor"
            className="rounded-2xl border border-white/10 bg-slate p-3 flex items-center gap-2 hover:border-accent/40 transition-colors"
          >
            <div className="size-9 rounded-lg bg-accent/10 text-accent grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold">AI Advisor</div>
              <div className="text-[10px] text-muted-foreground truncate">
                Ask about style
              </div>
            </div>
          </Link>
        </div>
      )}


      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <ImageIcon className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Open the camera, place a design, and tap "Save project".
          </p>
          <Link
            to="/ar"
            className="mt-4 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-ink font-bold text-sm"
          >
            Open AR camera
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl overflow-hidden border border-white/10 bg-slate"
            >
              <Link
                to="/projects/$id"
                params={{ id: p.id }}
                className="block"
              >
                <div className="aspect-square bg-ink grid place-items-center">
                  {p.preview_url ? (
                    <img
                      src={p.preview_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-8 text-muted-foreground" />
                  )}
                </div>
              </Link>
              <div className="p-3">
                <Link to="/projects/$id" params={{ id: p.id }}>
                  <div className="text-sm font-bold truncate">{p.name}</div>
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  {p.width_cm != null && (
                    <span className="flex items-center gap-1">
                      <Ruler className="size-3" />
                      {p.width_cm} cm
                    </span>
                  )}
                  {p.body_part && (
                    <span className="truncate">{p.body_part}</span>
                  )}
                  <span className="ml-auto">
                    {new Date(p.created_at).toLocaleDateString("en-US")}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => downloadPdf(p)}
                    disabled={pdfBusy === p.id}
                    className="flex-1 h-8 rounded-lg bg-accent text-ink font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1 disabled:opacity-60"
                  >
                    {pdfBusy === p.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <FileDown className="size-3" />
                    )}
                    PDF
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    aria-label="Remove"
                    className="size-8 rounded-lg border border-white/10 text-muted-foreground hover:text-destructive grid place-items-center"
                  >
                    <Trash2 className="size-3" />
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
