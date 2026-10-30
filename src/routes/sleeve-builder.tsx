import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Layers,
  Plus,
  RotateCcw,
  Trash2,
  Sparkles,
  Type as TypeIcon,
  Save,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { TATTOOS, TYPES, type TattooType } from "@/lib/tattoos";
import {
  TATTOO_FONTS,
  customTattooFonts,
  renderTextMotif,
  type TattooFont,
} from "@/lib/tattooFonts";
import { FontCatalogDialog } from "@/components/paint/FontCatalogDialog";
import { loadStoredCustomFonts, subscribeCustomFonts } from "@/lib/paint/customFonts";
import { saveMyMotif, listMyMotifs, subscribeMyMotifs, type MyMotif } from "@/lib/myMotifs";
import { useAuth } from "@/hooks/useAuth";
import { useMarketplace } from "@/hooks/useMarketplace";
import {
  deleteSleeveProject,
  listSleeveProjects,
  saveSleeveProject,
  type SleeveProject,
} from "@/lib/sleeveProjects";

export const Route = createFileRoute("/sleeve-builder")({
  head: () => ({
    meta: [
      { title: "Sleeve Builder — InkSimulator" },
      {
        name: "description",
        content:
          "Combine several designs and lettering into one composition and lay them out on an arm, leg, back, or chest.",
      },
      { property: "og:title", content: "Sleeve Builder — InkSimulator" },
      {
        property: "og:description",
        content:
          "Build a full sleeve: add motifs and text, drag them into place, resize and rotate.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/sleeve-builder" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/sleeve-builder" }],
  }),
  component: SleeveBuilder,
});

type Area = {
  id: string;
  label: string;
  /** width / height of the working surface */
  ratio: number;
  hint: string;
};

const AREAS: Area[] = [
  { id: "full-sleeve", label: "Full sleeve", ratio: 0.42, hint: "Shoulder to wrist." },
  { id: "half-sleeve", label: "Half sleeve", ratio: 0.6, hint: "Shoulder to elbow." },
  { id: "forearm", label: "Forearm", ratio: 0.55, hint: "Elbow to wrist." },
  { id: "leg", label: "Leg", ratio: 0.45, hint: "Thigh to ankle." },
  { id: "back", label: "Back", ratio: 0.85, hint: "Full back piece." },
  { id: "chest", label: "Chest", ratio: 1.25, hint: "Chest and collarbones." },
];

type Item = {
  key: string;
  src: string;
  name: string;
  /** 0..1 of the surface */
  x: number;
  y: number;
  /** width as a fraction of the surface width */
  size: number;
  rot: number;
};

function SleeveBuilder() {
  const [areaId, setAreaId] = useState(AREAS[0].id);
  const area = useMemo(() => AREAS.find((a) => a.id === areaId) ?? AREAS[0], [areaId]);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [text, setText] = useState("Forever");
  const [fontId, setFontId] = useState(TATTOO_FONTS[0].id);
  const [busy, setBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [customFonts, setCustomFonts] = useState<TattooFont[]>([]);
  const [source, setSource] = useState<"builtin" | "mine" | "bought">("builtin");
  const [category, setCategory] = useState<TattooType | "All">("All");
  const [mine, setMine] = useState<MyMotif[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled sleeve");
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SleeveProject[]>([]);
  const [savedSignature, setSavedSignature] = useState("");

  const { user } = useAuth();
  const { motifs: marketMotifs } = useMarketplace(user?.id);

  // Fonts installed from the catalogue are shared with the other tools.
  useEffect(() => {
    const sync = () => setCustomFonts(customTattooFonts());
    void loadStoredCustomFonts().then(sync);
    sync();
    return subscribeCustomFonts(sync);
  }, []);

  const fonts = useMemo(() => [...customFonts, ...TATTOO_FONTS], [customFonts]);

  // Your own saved designs (uploads, drawings, lettering, AI motifs).
  useEffect(() => {
    const sync = () => setMine(listMyMotifs());
    sync();
    return subscribeMyMotifs(sync);
  }, []);

  const bought = useMemo(
    () => marketMotifs.filter((m) => m.purchased && m.image_url),
    [marketMotifs],
  );

  const pickerItems = useMemo(() => {
    if (source === "mine") return mine.map((m) => ({ key: m.id, src: m.src, name: m.name }));
    if (source === "bought")
      return bought.map((m) => ({
        key: m.id,
        src: m.image_url as string,
        name: m.name,
      }));
    return TATTOOS.filter((t) => category === "All" || t.type === category).map((t) => ({
      key: t.id,
      src: t.src,
      name: t.name,
    }));
  }, [source, mine, bought, category]);

  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);

  const active = items.find((i) => i.key === selected) ?? null;
  const signature = useMemo(() => JSON.stringify({ areaId, items }), [areaId, items]);
  const dirty = items.length > 0 && signature !== savedSignature;

  const addItem = (src: string, name: string) => {
    const key = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [
      ...prev,
      {
        key,
        src,
        name,
        x: 0.5,
        y: Math.min(0.85, 0.2 + prev.length * 0.12),
        size: 0.45,
        rot: 0,
      },
    ]);
    setSelected(key);
    setPickerOpen(false);
    requestAnimationFrame(() =>
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  };

  const patch = (key: string, next: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)));

  const onPointerDown = useCallback((e: React.PointerEvent, item: Item) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    setSelected(item.key);
    const dx = (e.clientX - rect.left) / rect.width - item.x;
    const dy = (e.clientY - rect.top) / rect.height - item.y;

    const move = (ev: PointerEvent) => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return;
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width - dx));
      const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height - dy));
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, x, y } : i)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }, []);

  const addText = async () => {
    const font = fonts.find((f) => f.id === fontId) ?? TATTOO_FONTS[0];
    setBusy(true);
    try {
      const url = await renderTextMotif({ text, font });
      if (url) addItem(url, text);
      setTextOpen(false);
    } finally {
      setBusy(false);
    }
  };

  /** Renders the composition; transparent background when `transparent`. */
  const compose = useCallback(
    async (transparent: boolean) => {
      const W = 1200;
      const H = Math.round(W / area.ratio);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      if (!transparent) {
        ctx.fillStyle = "#f6f2ea";
        ctx.fillRect(0, 0, W, H);
      }
      for (const item of items) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = item.src;
        });
        if (!img.width) continue;
        const w = item.size * W;
        const h = (w / img.width) * img.height;
        ctx.save();
        ctx.translate(item.x * W, item.y * H);
        ctx.rotate((item.rot * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
      return canvas.toDataURL("image/png");
    },
    [area.ratio, items],
  );

  const exportPng = async () => {
    setBusy(true);
    try {
      const url = await compose(false);
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `inksimulator-${area.id}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  const saveProject = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const preview = await compose(false);
      if (!preview) throw new Error("Could not create a preview.");
      const saved = saveSleeveProject({
        id: projectId ?? undefined,
        name: projectName,
        areaId,
        items,
        preview,
      });
      setProjectId(saved.id);
      setProjectName(saved.name);
      setSavedSignature(signature);
      setSavedProjects(listSleeveProjects());
      toast.success("Sleeve project saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the project.");
    } finally {
      setBusy(false);
    }
  };

  const openProject = (project: SleeveProject) => {
    setAreaId(project.areaId);
    setItems(project.items);
    setProjectId(project.id);
    setProjectName(project.name);
    setSavedSignature(JSON.stringify({ areaId: project.areaId, items: project.items }));
    setSelected(null);
    setProjectsOpen(false);
    toast.success(`${project.name} opened`);
  };

  const showProjects = () => {
    setSavedProjects(listSleeveProjects());
    setProjectsOpen(true);
  };

  /** Save the sleeve as a custom motif and open it in the AR camera. */
  const tryInAr = async () => {
    setBusy(true);
    try {
      const url = await compose(true);
      if (!url) return;
      // Rough real-world width of the composition on skin.
      const widthCm =
        area.id === "chest" || area.id === "back" ? 34 : area.id === "forearm" ? 12 : 16;
      const motif = saveMyMotif({
        name: `${area.label} sleeve`,
        src: url,
        widthCm,
        source: "upload",
      });
      await navigate({ to: "/ar", search: { motif: motif.id } as never });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <header className="mb-5">
        <div className="text-mono-caps text-[10px] text-accent">Explore</div>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight">Sleeve Builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a surface, add designs and lettering, then drag everything into place to compose a
          full sleeve.
        </p>
      </header>

      {/* Surface picker */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        {AREAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAreaId(a.id)}
            aria-pressed={a.id === areaId}
            className={`flex-none px-3 h-9 rounded-full border text-[11px] font-bold uppercase tracking-widest transition ${
              a.id === areaId
                ? "border-accent bg-accent text-ink"
                : "border-white/15 bg-ink/60 text-foreground/80"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative mx-auto max-w-full overflow-hidden rounded-3xl border border-paper-ink/20 bg-paper shadow-lg touch-none"
        style={{
          width: `min(100%, ${(56 * area.ratio).toFixed(2)}vh, 380px)`,
          aspectRatio: String(area.ratio),
        }}
      >
        {items.length === 0 && (
          <div className="absolute inset-0 grid place-items-center gap-3 p-4 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-paper-ink/60">{area.hint}</p>
              <button
                onClick={() => setPickerOpen(true)}
                className="mt-3 h-11 px-5 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-2"
              >
                <Plus className="size-4" /> Add design
              </button>
              <button
                onClick={() => setTextOpen(true)}
                className="mt-2 block mx-auto h-10 px-4 rounded-xl border border-paper-ink/25 text-[11px] font-bold uppercase tracking-widest text-paper-ink"
              >
                Add text
              </button>
            </div>
          </div>
        )}
        {items.map((item) => (
          <img
            key={item.key}
            src={item.src}
            alt={item.name}
            draggable={false}
            onPointerDown={(e) => onPointerDown(e, item)}
            className={`absolute select-none touch-none cursor-grab active:cursor-grabbing ${
              item.key === selected ? "outline outline-1 outline-accent/70" : ""
            }`}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              width: `${item.size * 100}%`,
              transform: `translate(-50%, -50%) rotate(${item.rot}deg)`,
            }}
          />
        ))}
      </div>

      {/* Selected item controls */}
      {active && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-ink/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent truncate">
              {active.name}
            </span>
            <div className="flex gap-2">
              <button
                aria-label="Bring to front"
                onClick={() =>
                  setItems((prev) => [...prev.filter((i) => i.key !== active.key), active])
                }
                className="size-9 rounded-lg border border-white/10 grid place-items-center"
              >
                <Layers className="size-4" />
              </button>
              <button
                aria-label="Reset rotation"
                onClick={() => patch(active.key, { rot: 0 })}
                className="size-9 rounded-lg border border-white/10 grid place-items-center"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                aria-label="Remove design"
                onClick={() => {
                  setItems((prev) => prev.filter((i) => i.key !== active.key));
                  setSelected(null);
                }}
                className="size-9 rounded-lg border border-white/10 grid place-items-center text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Size
          </label>
          <input
            type="range"
            min={0.1}
            max={1.2}
            step={0.01}
            value={active.size}
            onChange={(e) => patch(active.key, { size: Number(e.target.value) })}
            className="w-full accent-accent"
          />
          <label className="block mt-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Rotation
          </label>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={active.rot}
            onChange={(e) => patch(active.key, { rot: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>
      )}

      {/* Actions */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Project name
        </span>
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          maxLength={80}
          className="field"
        />
      </label>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          size="lg"
          onClick={() => void saveProject()}
          disabled={busy || items.length === 0}
          className="h-12 justify-center font-bold uppercase"
        >
          <Save className="size-4" /> Save project{dirty ? " *" : ""}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-12"
          onClick={showProjects}
          aria-label="Open saved sleeve projects"
        >
          <FolderOpen className="size-4" />
        </Button>
      </div>
      <button
        onClick={() => void tryInAr()}
        disabled={busy || items.length === 0}
        className="mt-2 w-full h-12 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
      >
        <Sparkles className="size-4" /> Try this sleeve in AR
      </button>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          onClick={() => setPickerOpen(true)}
          className="h-11 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <Plus className="size-4" /> Design
        </button>
        <button
          onClick={() => setTextOpen(true)}
          className="h-11 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <TypeIcon className="size-4" /> Text
        </button>
        <button
          onClick={exportPng}
          disabled={busy || items.length === 0}
          className="h-11 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Download className="size-4" /> Export
        </button>
      </div>

      {/* Motif palette */}
      <h2 className="mt-6 mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Tap a design to add it
      </h2>
      <SourceTabs source={source} onChange={setSource} />
      {source === "builtin" && <CategoryChips value={category} onChange={setCategory} />}
      <div className="mt-2 grid grid-cols-4 gap-2 pb-4">
        {pickerItems.map((t) => (
          <MotifTile key={t.key} item={t} onAdd={addItem} />
        ))}
      </div>
      {pickerItems.length === 0 && <EmptySource source={source} signedIn={Boolean(user)} />}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-lg p-5 flex flex-col">
          <h2 className="font-display font-bold text-lg mb-3">Add a design</h2>
          <SourceTabs source={source} onChange={setSource} />
          {source === "builtin" && <CategoryChips value={category} onChange={setCategory} />}
          <div className="mt-3 flex-1 overflow-y-auto grid grid-cols-3 gap-2 content-start">
            {pickerItems.map((t) => (
              <MotifTile key={t.key} item={t} onAdd={addItem} />
            ))}
            {pickerItems.length === 0 && (
              <div className="col-span-3">
                <EmptySource source={source} signedIn={Boolean(user)} />
              </div>
            )}
          </div>
          <button
            onClick={() => setPickerOpen(false)}
            className="mt-3 h-11 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest"
          >
            Close
          </button>
        </div>
      )}

      {textOpen && (
        <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-lg p-5 flex flex-col">
          <h2 className="font-display font-bold text-lg mb-3">Add lettering</h2>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-12 rounded-xl bg-white/5 border border-white/10 px-4 mb-3"
            placeholder="Your text"
          />
          <button
            onClick={() => setCatalogOpen(true)}
            className="mb-3 h-10 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest"
          >
            Font catalogue
          </button>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2">
            {fonts.map((f) => (
              <button
                key={f.id}
                onClick={() => setFontId(f.id)}
                aria-pressed={f.id === fontId}
                className={`h-14 rounded-xl border px-3 text-left ${
                  f.id === fontId ? "border-accent" : "border-white/10"
                }`}
                style={{ fontFamily: `"${f.family}"` }}
              >
                <span className="text-lg">{text || f.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setTextOpen(false)}
              className="flex-1 h-11 rounded-xl border border-white/15 text-[11px] font-bold uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={() => void addText()}
              disabled={busy || !text.trim()}
              className="flex-1 h-11 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <FontCatalogDialog
            open={catalogOpen}
            onOpenChange={setCatalogOpen}
            onInstalled={(id) => {
              setCustomFonts(customTattooFonts());
              setFontId(id);
              setCatalogOpen(false);
            }}
          />
        </div>
      )}

      {projectsOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-5 backdrop-blur-lg">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">Saved sleeve projects</h2>
            <Button type="button" variant="outline" onClick={() => setProjectsOpen(false)}>
              Close
            </Button>
          </div>
          <div className="mt-4 grid flex-1 content-start grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {savedProjects.map((project) => (
              <article
                key={project.id}
                className="overflow-hidden rounded-md border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => openProject(project)}
                  className="block w-full bg-artwork p-2 text-left"
                >
                  <img
                    src={project.preview}
                    alt=""
                    className="aspect-[3/4] w-full object-contain"
                  />
                  <span className="mt-2 block truncate text-sm font-bold text-card-foreground">
                    {project.name}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive"
                  onClick={() => {
                    deleteSleeveProject(project.id);
                    setSavedProjects(listSleeveProjects());
                    if (projectId === project.id) setProjectId(null);
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </article>
            ))}
            {savedProjects.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">
                No saved sleeve projects yet.
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

type PickerItem = { key: string; src: string; name: string };

function CategoryChips({
  value,
  onChange,
}: {
  value: TattooType | "All";
  onChange: (v: TattooType | "All") => void;
}) {
  return (
    <div className="mt-2 -mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar">
      {(["All", ...TYPES] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-pressed={c === value}
          className={`px-3 h-8 rounded-full border text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition ${
            c === value
              ? "border-accent bg-accent text-ink"
              : "border-white/15 bg-ink/60 text-foreground/80"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function SourceTabs({
  source,
  onChange,
}: {
  source: "builtin" | "mine" | "bought";
  onChange: (s: "builtin" | "mine" | "bought") => void;
}) {
  const tabs: { id: "builtin" | "mine" | "bought"; label: string }[] = [
    { id: "builtin", label: "Designs" },
    { id: "mine", label: "My designs" },
    { id: "bought", label: "Bought (Pilot)" },
  ];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-pressed={t.id === source}
          className={`flex-1 h-9 rounded-full border text-[11px] font-bold uppercase tracking-widest transition ${
            t.id === source
              ? "border-accent bg-accent text-ink"
              : "border-white/15 bg-ink/60 text-foreground/80"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function MotifTile({
  item,
  onAdd,
}: {
  item: PickerItem;
  onAdd: (src: string, name: string) => void;
}) {
  return (
    <button
      onClick={() => onAdd(item.src, item.name)}
      className="motif-contrast-grid relative aspect-square rounded-md border-2 border-border bg-artwork p-2 shadow-sm transition active:scale-95"
      aria-label={`Add ${item.name}`}
    >
      <img
        src={item.src}
        alt={item.name}
        crossOrigin="anonymous"
        className="size-full object-contain"
        loading="lazy"
      />
      <Plus className="absolute bottom-1 right-1 size-3.5 text-accent" />
    </button>
  );
}

function EmptySource({
  source,
  signedIn,
}: {
  source: "builtin" | "mine" | "bought";
  signedIn: boolean;
}) {
  if (source === "builtin") return null;
  if (source === "bought" && !signedIn)
    return (
      <p className="text-sm text-muted-foreground">
        <Link to="/auth" className="text-accent underline">
          Sign in
        </Link>{" "}
        to use designs you have bought.
      </p>
    );
  return (
    <p className="text-sm text-muted-foreground">
      {source === "mine" ? (
        <>
          Nothing saved yet — draw one in the{" "}
          <Link to="/rita" className="text-accent underline">
            drawing studio
          </Link>{" "}
          or upload a design in your{" "}
          <Link to="/library" className="text-accent underline">
            library
          </Link>
          .
        </>
      ) : (
        <>
          No purchased designs yet — browse the{" "}
          <Link to="/shop" className="text-accent underline">
            gallery
          </Link>
          .
        </>
      )}
    </p>
  );
}
