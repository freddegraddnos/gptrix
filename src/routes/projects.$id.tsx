import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ArrowLeft,
  Camera,
  FileDown,
  History,
  ImageIcon,
  Loader2,
  Plus,
  Printer,
  Ruler,
  Save,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { uploadPreview } from "@/hooks/useProjects";
import {
  useProjectWorkspace,
  BOOKING_STATUSES,
  SHELVES,
  type ProjectAssetKind,
} from "@/hooks/useProjectWorkspace";
import { exportProjectDossierPdf } from "@/lib/pdf";
import { JourneyTimeline } from "@/components/JourneyTimeline";
import { PrintExportDialog } from "@/components/PrintExportDialog";
import { tx, useUiLang } from "@/lib/uiLang";
import { setActiveIdea, SIZE_DIMENSIONS, SIZE_SOURCES, type SizeDimension, type SizeSource } from "@/lib/ideaContext";


export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "My tattoo project — InkSimulator" },
      {
        name: "description",
        content:
          "Collect designs, reference images, body photos, measurements, notes, and booking status in one project.",
      },
      { property: "og:title", content: "My tattoo project — InkSimulator" },
      {
        property: "og:description",
        content: "Everything about your next tattoo in one place — and a PDF for your artist.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProjectDetailPage,
});

const TABS = [
  { id: "motifs", label: "Designs" },
  { id: "journey", label: "Journey" },
  { id: "refs", label: "References" },
  { id: "body", label: "Body photos" },
  { id: "specs", label: "Placement" },
  { id: "notes", label: "Notes" },
  { id: "history", label: "Versions" },
] as const;


type TabId = (typeof TABS)[number]["id"];

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });

function ProjectDetailPage() {
  useUiLang();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    project,
    assets,
    versions,
    loading,
    update,
    addAsset,
    removeAsset,
    saveVersion,
  } = useProjectWorkspace(id, user?.id);

  const [tab, setTab] = useState<TabId>("motifs");
  const [notes, setNotes] = useState("");
  const [placement, setPlacement] = useState("");
  const [artistName, setArtistName] = useState("");
  const [sizeCm, setSizeCm] = useState("");
  const [sizeDimension, setSizeDimension] = useState<SizeDimension | "">("");
  const [sizeUnsure, setSizeUnsure] = useState(false);
  const [placementUnsure, setPlacementUnsure] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);


  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!project) return;
    setNotes(project.notes ?? "");
    setPlacement(project.placement_note ?? "");
    setArtistName(project.artist_name ?? "");
    setSizeCm(project.width_cm != null ? String(Number(project.width_cm)) : "");
    setSizeDimension(project.size_dimension ?? "");
    setSizeUnsure(!!project.size_unsure);
    setPlacementUnsure(!!project.placement_unsure);
  }, [project]);

  const byKind = useMemo(
    () => ({
      motif: assets.filter((a) => a.kind === "motif"),
      reference: assets.filter((a) => a.kind === "reference"),
      body: assets.filter((a) => a.kind === "body"),
    }),
    [assets],
  );

  const printSources = useMemo(() => {
    const list: { url: string; label: string }[] = [];
    const cover = project?.cover_url ?? project?.preview_url;
    if (cover) list.push({ url: cover, label: "Cover" });
    for (const a of assets) {
      if (a.kind !== "motif" && a.kind !== "final_design" && a.kind !== "idea")
        continue;
      if (list.some((s) => s.url === a.image_url)) continue;
      list.push({ url: a.image_url, label: a.title ?? "Design" });
    }
    return list;
  }, [project?.cover_url, project?.preview_url, assets]);

  const upload = async (file: File, kind: ProjectAssetKind) => {
    if (!user) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { signedUrl } = await uploadPreview(user.id, dataUrl);
      if (signedUrl)
        await addAsset({ kind, imageUrl: signedUrl, title: file.name });
    } finally {
      setUploading(false);
    }
  };

  const saveMeta = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const saved = project.width_cm != null ? String(Number(project.width_cm)) : "";
      const sizeChanged = sizeCm !== saved;
      const n = Number(sizeCm);
      await update(
        {
          notes: notes.trim() || null,
          placement_note: placement.trim() || null,
          artist_name: artistName.trim() || null,
          size_dimension: sizeDimension || null,
          size_unsure: sizeUnsure,
          placement_unsure: placementUnsure,
          // A calibrated measurement is only replaced when the customer edits the number.
          ...(sizeChanged
            ? { width_cm: sizeCm && n > 0 ? n : null, size_source: sizeCm && n > 0 ? ("manual" as SizeSource) : null }
            : {}),
        },
        "Updated project info",
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    if (!project) return;
    setPdfBusy(true);
    try {
      await exportProjectDossierPdf({
        name: project.name,
        createdAt: project.created_at,
        bodyPart: project.body_part,
        widthCm: project.width_cm,
        placementNote: project.placement_note,
        notes: project.notes,
        artistName: project.artist_name,
        bookingStatus:
          BOOKING_STATUSES.find((b) => b.value === project.booking_status)
            ?.label ?? project.booking_status,
        coverUrl: project.cover_url ?? project.preview_url,
        assets,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading || !project) {
    return (
      <AppShell>
        <div className="py-20 grid place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  const uploadTile = (kind: ProjectAssetKind, label: string) => (
    <label className="aspect-square rounded-xl border-2 border-dashed border-white/20 grid place-items-center cursor-pointer text-muted-foreground">
      {uploading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <span className="flex flex-col items-center gap-1">
          <Plus className="size-5" />
          <span className="text-[9px] uppercase font-bold">{label}</span>
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f, kind);
          e.target.value = "";
        }}
      />
    </label>
  );

  const grid = (
    list: typeof assets,
    kind: ProjectAssetKind,
    label: string,
    empty: string,
  ) => (
    <>
      <div className="grid grid-cols-3 gap-2">
        {list.map((a) => (
          <figure
            key={a.id}
            className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-slate"
          >
            <img
              src={a.image_url}
              alt={a.title ?? label}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => removeAsset(a.id)}
              aria-label="Remove image"
              className="absolute top-1 right-1 size-7 rounded-full bg-ink/80 grid place-items-center"
            >
              <Trash2 className="size-3" />
            </button>
          </figure>
        ))}
        {uploadTile(kind, label)}
      </div>
      {list.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">{empty}</p>
      )}
    </>
  );

  return (
    <AppShell>
      <header className="mb-4">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
        >
          <ArrowLeft className="size-3" /> All projects
        </Link>
        <h1 className="mt-2 font-display font-bold text-2xl">{project.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {project.width_cm != null && (
            <span className="flex items-center gap-1">
              <Ruler className="size-3" />
              {Number(project.width_cm).toFixed(1)} cm
            </span>
          )}
          {project.body_part && <span>{project.body_part}</span>}
          <span>
            {new Date(project.created_at).toLocaleDateString("en-US")}
          </span>
        </div>
      </header>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <Link
          to="/ar"
          search={{ motif: project.tattoo_id ?? undefined }}
          className="h-10 rounded-xl bg-accent text-ink font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
        >
          <Camera className="size-3.5" /> AR
        </Link>
        <button
          onClick={() => setPrintOpen(true)}
          className="h-10 rounded-xl border border-white/15 bg-slate font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"
        >
          <Printer className="size-3.5" /> Print
        </button>
        <button
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="h-10 rounded-xl border border-white/15 bg-slate font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {pdfBusy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FileDown className="size-3.5" />
          )}
          PDF
        </button>
      </div>
      <Link
        to="/studios"
        search={{ idea: project.id }}
        onClick={() => setActiveIdea(project.id)}
        className="mb-4 h-11 rounded-xl border border-accent bg-slate font-bold text-xs flex items-center justify-center gap-2"
      >
        <UserIcon className="size-4" /> {tx("Find a studio for this idea")}
      </Link>

      <PrintExportDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        sources={printSources}
        title={project.name}
        bodyPart={project.body_part}
        note={project.placement_note}
        defaultWidthCm={project.width_cm}
      />


      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`flex-none px-3 h-9 rounded-full border text-[11px] font-bold transition ${
              tab === t.id
                ? "border-accent bg-accent text-ink"
                : "border-white/15 text-foreground/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "motifs" &&
        grid(
          byKind.motif,
          "motif",
          "Designs",
          "Save AR tests and AI designs here.",
        )}
      {tab === "journey" && (
        <JourneyTimeline
          projectName={project.name}
          assets={assets}
          uploading={uploading}
          isPublic={project.journey_public}
          onUpload={(file, kind) => upload(file, kind)}
          onRemove={removeAsset}
          onTogglePublic={(next) =>
            update(
              { journey_public: next },
              next ? "Journey public" : "Journey private",
            )
          }
        />
      )}
      {tab === "refs" && (
        <>
          {grid(byKind.reference, "reference", "Reference", "Upload inspiration images for your artist.")}
          {byKind.reference.length > 0 && (
            <fieldset className="mt-4 rounded-2xl border border-white/10 bg-slate p-3">
              <legend className="px-1 text-mono-caps text-[10px] text-muted-foreground">{tx("Include in studio requests")}</legend>
              {byKind.reference.map((a) => {
                const on = (project.shared_reference_ids ?? []).includes(a.id);
                return (
                  <label key={a.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={on}
                      onChange={() => {
                        const cur = project.shared_reference_ids ?? [];
                        void update({ shared_reference_ids: on ? cur.filter((x) => x !== a.id) : [...cur, a.id] });
                      }}
                    />
                    <img src={a.image_url} alt="" className="size-9 rounded object-cover" />
                    <span className="truncate">{a.title ?? tx("Reference")}</span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </>
      )}
      {tab === "body" &&
        grid(
          byKind.body,
          "body",
          "Body",
          "Photograph the body part over time to track progress.",
        )}

      {tab === "specs" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-2">
            <div className="text-mono-caps text-[10px] text-muted-foreground">{tx("Size")}</div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.1"
                inputMode="decimal"
                aria-label={tx("Size (cm)")}
                value={sizeCm}
                onChange={(e) => setSizeCm(e.target.value)}
                className="w-28 h-11 rounded-xl bg-background border border-white/10 px-3 text-sm outline-none focus:border-accent"
              />
              <select
                aria-label={tx("Size refers to")}
                value={sizeDimension}
                onChange={(e) => setSizeDimension(e.target.value as SizeDimension | "")}
                className="flex-1 h-11 rounded-xl bg-background border border-white/10 px-3 text-sm"
              >
                <option value="">{tx("Size refers to")}…</option>
                {SIZE_DIMENSIONS.map((d) => <option key={d.value} value={d.value}>{tx(d.label)}</option>)}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tx("Source")}: {project.width_cm != null ? tx(SIZE_SOURCES.find((x) => x.value === project.size_source)?.label ?? "Calibrated in AR") : "—"} · {project.body_part || tx("body part not set")}
            </p>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={sizeUnsure} onChange={(e) => setSizeUnsure(e.target.checked)} />
              {tx("I'm not sure about the size")}
            </label>
          </div>
          <label className="block">
            <span className="text-mono-caps text-[10px] text-muted-foreground">
              Placement
            </span>
            <input
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              placeholder="E.g. outer forearm, 6 cm below the elbow"
              className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={placementUnsure} onChange={(e) => setPlacementUnsure(e.target.checked)} />
            {tx("I'm not sure about the placement")}
          </label>
          <label className="block">
            <span className="text-mono-caps text-[10px] text-muted-foreground">
              Linked artist
            </span>
            <input
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="Studio or artist"
              className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <div>
            <span className="text-mono-caps text-[10px] text-muted-foreground">
              Booking status
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BOOKING_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() =>
                    update({ booking_status: s.value }, `Status: ${s.label}`)
                  }
                  aria-pressed={project.booking_status === s.value}
                  className={`px-3 h-9 rounded-full border text-[11px] font-bold ${
                    project.booking_status === s.value
                      ? "border-accent bg-accent text-ink"
                      : "border-white/15 text-foreground/80"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-mono-caps text-[10px] text-muted-foreground">
              Shown on public profile as
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SHELVES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update({ shelf: s.value }, `Tab: ${s.label}`)}
                  aria-pressed={project.shelf === s.value}
                  className={`px-3 h-9 rounded-full border text-[11px] font-bold ${
                    project.shelf === s.value
                      ? "border-accent bg-accent text-ink"
                      : "border-white/15 text-foreground/80"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={saveMeta}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </button>
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            placeholder="Ideas, style, color, budget, questions for the artist …"
            className="w-full rounded-2xl bg-slate border border-white/10 p-3 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={saveMeta}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save notes
          </button>
        </div>
      )}

      {tab === "history" && (
        <>
        <button
          onClick={() =>
            void saveVersion(`${tx("Variant")} · ${new Date().toLocaleDateString()}`, {
              variant: true,
              tattoo_id: project.tattoo_id,
              tattoo_name: project.tattoo_name,
              preview_url: project.preview_url,
              width_cm: project.width_cm,
              size_dimension: project.size_dimension,
              size_source: project.size_source,
              size_unsure: project.size_unsure,
              body_part: project.body_part,
              placement_note: project.placement_note,
              placement_unsure: project.placement_unsure,
            })
          }
          className="mb-3 w-full h-11 rounded-xl border border-white/15 bg-slate font-bold text-xs flex items-center justify-center gap-2"
        >
          <Plus className="size-4" /> {tx("Save current design, size and placement as a variant")}
        </button>
        <ul className="space-y-2">
          {versions.length === 0 && (
            <li className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-xs text-muted-foreground">
              <History className="size-5 mx-auto mb-2" />
              Every change you save shows up here as a version.
            </li>
          )}
          {versions.map((v) => (
            <li
              key={v.id}
              className="rounded-2xl border border-white/10 bg-slate p-3"
            >
              <div className="text-sm font-bold">{v.label ?? "Version"}</div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(v.created_at).toLocaleString("en-US")}
              </div>
              <pre className="mt-2 text-[10px] text-muted-foreground whitespace-pre-wrap break-words">
                {JSON.stringify(v.snapshot, null, 1)}
              </pre>
            </li>
          ))}
        </ul>
        </>
      )}

      {assets.length === 0 && tab === "motifs" && (
        <p className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1">
          <ImageIcon className="size-3" />
          Tip: save an AR capture and it becomes the project cover image.
        </p>
      )}
    </AppShell>
  );
}
