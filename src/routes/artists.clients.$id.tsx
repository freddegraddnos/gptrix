import { StudioButton as Button } from "@/components/StudioPrimitives";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Copy,
  Film,
  Loader2,
  Save,
  Send,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { StudioShell } from "@/components/StudioShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useArtistMode, type ClientProject } from "@/hooks/useArtistMode";
import { uploadPreview } from "@/hooks/useProjects";
import { fileToDataUrl, keyOutBackground } from "@/lib/motifExtract";
import { TATTOOS } from "@/lib/tattoos";
import { listMyMotifs, type MyMotif } from "@/lib/myMotifs";
import {
  DEFAULT_DESIGN,
  INK_COLORS,
  composeAfterImage,
  composeBeforeImage,
  inviteLink,
  parseDesign,
  previewLink,
  type DesignState,
} from "@/lib/artistStudio";
import { stashBeforeAfter } from "@/lib/beforeAfterVideo";
import { copyToClipboard, shareLink } from "@/lib/share";

import { tx, useUiLang } from "@/lib/uiLang";
import { clientRelationLabel } from "@/lib/clientRelationLabel";
export const Route = createFileRoute("/artists/clients/$id")({
  head: () => ({
    meta: [
      { title: tx("Client Project — Artist Mode | InkSimulator") },
      {
        name: "description",
        content:
          "Test placement and size on the client's photo, adjust the design, and send a preview link.",
      },
      { property: "og:title", content: "Client concept — InkSimulator" },
      { property: "og:description", content: "Private studio customer concept and placement workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientProjectPage,
});

function ClientProjectPage() {
  useUiLang();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { verified, loading: artistLoading } = useArtistMode(user?.id);

  const [project, setProject] = useState<ClientProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [basePhoto, setBasePhoto] = useState<string | null>(null);
  const [motif, setMotif] = useState<string | null>(null);
  const [myMotifs, setMyMotifs] = useState<MyMotif[]>([]);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("artist_client_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const row = (data ?? null) as ClientProject | null;
    setProject(row);
    if (row) {
      setDesign(parseDesign(row.design));
      setBasePhoto(row.base_photo_url);
      setMotif(row.motif_url);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMyMotifs(listMyMotifs());
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/artists" });
  }, [authLoading, user, navigate]);

  if (authLoading || artistLoading || loading) {
    return (
      <StudioShell current="concepts" detail narrow>
        <div className="py-20 grid place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </StudioShell>
    );
  }

  if (!verified || !project) {
    return (
      <StudioShell current="concepts" detail narrow>
        <div className="py-16 text-center">
          <ShieldAlert className="mx-auto size-6 text-accent" />
          <p className="mt-3 text-sm text-muted-foreground">
            {tx("The project couldn't be opened in artist mode.")}
          </p>
          <Link
            to="/artists/clients"
            className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 text-sm font-bold text-ink"
          >
            {tx("To client projects")}
          </Link>
        </div>
      </StudioShell>
    );
  }

  const patch = async (values: Partial<ClientProject>) => {
    await supabase
      .from("artist_client_projects")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(values as any)
      .eq("id", id);
    setProject((p) => (p ? { ...p, ...values } : p));
  };

  const onPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { signedUrl } = await uploadPreview(user.id, dataUrl);
      if (signedUrl) {
        setBasePhoto(signedUrl);
        await patch({ base_photo_url: signedUrl });
      }
    } finally {
      setUploading(false);
    }
  };

  const onMotifFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const raw = await fileToDataUrl(file);
      const clean = await keyOutBackground(raw);
      const { signedUrl } = await uploadPreview(user.id, clean);
      if (signedUrl) {
        setMotif(signedUrl);
        await patch({ motif_url: signedUrl });
      }
    } finally {
      setUploading(false);
    }
  };

  const pickMotif = async (src: string) => {
    setMotif(src);
    await patch({ motif_url: src });
  };

  const onStagePointer = (e: React.PointerEvent) => {
    if (!stageRef.current || !motif) return;
    const r = stageRef.current.getBoundingClientRect();
    setDesign((d) => ({
      ...d,
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }));
  };

  const saveDesign = async () => {
    setSaving(true);
    try {
      await patch({ design: design as unknown as Record<string, unknown> });
      toast.success(tx("Design saved"));
    } finally {
      setSaving(false);
    }
  };

  const renderBeforeAfter = async () => {
    if (!user || !basePhoto || !motif) {
      toast.error(tx("Upload the client's photo and pick a design first."));
      return;
    }
    setRendering(true);
    try {
      const [before, after] = await Promise.all([
        composeBeforeImage(basePhoto),
        composeAfterImage(basePhoto, motif, design),
      ]);
      const [b, a] = await Promise.all([
        uploadPreview(user.id, before),
        uploadPreview(user.id, after),
      ]);
      await patch({
        before_url: b.signedUrl,
        after_url: a.signedUrl,
        design: design as unknown as Record<string, unknown>,
        status: "preview",
      });
      stashBeforeAfter({ before, after });
      toast.success(tx("Before/after generated"));
    } catch {
      toast.error(tx("Could not generate before/after."));
    } finally {
      setRendering(false);
    }
  };

  const link = previewLink(project.preview_token);

  return (
    <StudioShell current="concepts" detail narrow title={project.title}>
      <header className="-mt-3 mb-4">
        <p className="text-[11px] text-muted-foreground">
          {clientRelationLabel(project, (s) => s === "linked" ? tx(" · linked").replace(/^ · /, "") : s === "awaiting invite" ? tx(" · awaiting invite").replace(/^ · /, "") : tx(s))}
        </p>
      </header>

      {/* Stage */}
      <div
        ref={stageRef}
        onPointerDown={onStagePointer}
        onPointerMove={(e) => e.buttons === 1 && onStagePointer(e)}
        className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-slate touch-none"
      >
        {basePhoto ? (
          <img
            src={basePhoto}
            alt={tx("Client's photo")}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center px-6 text-sm text-muted-foreground">
            {tx("Upload the client's photo — or use Live Try-On to capture an image directly.")}
          </div>
        )}
        {basePhoto && motif && (
          <img
            src={motif}
            alt={tx("Design")}
            className="absolute pointer-events-none select-none"
            style={{
              left: `${design.x * 100}%`,
              top: `${design.y * 100}%`,
              width: `${design.scale * 100}%`,
              opacity: design.opacity,
              transform: `translate(-50%,-50%) rotate(${design.rotation}deg)`,
              filter: design.tint
                ? `brightness(0) drop-shadow(0 0 0 ${design.tint})`
                : undefined,
            }}
          />
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="h-10 rounded-xl border border-white/15 bg-slate text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5 cursor-pointer">
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {tx("Client photo")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPhoto(f);
              e.target.value = "";
            }}
          />
        </label>
        <Link
          to="/ar"
          search={{} as never}
          className="h-10 rounded-xl border border-white/15 bg-slate text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5"
        >
          <Camera className="size-3.5" />{" "}{tx("Live Try-On")}
        </Link>
        <Link
          to="/before-after"
          className="h-10 rounded-xl border border-white/15 bg-slate text-[10px] uppercase font-bold tracking-widest flex items-center justify-center gap-1.5"
        >
          <Film className="size-3.5" />{" "}{tx("Video")}
        </Link>
      </div>

      {/* Design selection */}
      <section className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-mono-caps text-[10px] text-muted-foreground">
            {tx("Design")}
          </span>
          <label className="text-[10px] font-bold text-accent cursor-pointer">
            {tx("Upload sketch")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onMotifFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {myMotifs.map((m) => (
            <Button variant="outline"
              key={m.id}
              onClick={() => void pickMotif(m.src)}
              className="studio-media-control flex-none size-16 rounded-xl border border-white/10 bg-ink p-1"
            >
              <img src={m.src} alt={m.name} className="h-full w-full object-contain" />
            </Button>
          ))}
          {TATTOOS.map((t) => (
            <Button variant="outline"
              key={t.id}
              onClick={() => void pickMotif(t.src)}
              className="studio-media-control flex-none size-16 rounded-xl border border-white/10 bg-ink p-1"
            >
              <img src={t.src} alt={t.name} className="h-full w-full object-contain" />
            </Button>
          ))}
        </div>
      </section>

      {/* Editing */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-slate p-4 space-y-3">
        <Slider
          label={tx("Size")}
          value={design.scale}
          min={0.05}
          max={1}
          step={0.01}
          onChange={(v) => setDesign((d) => ({ ...d, scale: v }))}
        />
        <Slider
          label={tx("Rotation")}
          value={design.rotation}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => setDesign((d) => ({ ...d, rotation: v }))}
        />
        <Slider
          label={tx("Intensity")}
          value={design.opacity}
          min={0.2}
          max={1}
          step={0.01}
          onChange={(v) => setDesign((d) => ({ ...d, opacity: v }))}
        />
        <div>
          <span className="text-mono-caps text-[10px] text-muted-foreground">
            {tx("Ink color")}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {INK_COLORS.map((c) => (
              <Button variant="outline"
                key={c.label}
                onClick={() => setDesign((d) => ({ ...d, tint: c.value }))}
                aria-pressed={design.tint === c.value}
                className={`px-3 h-9 rounded-full border text-[11px] font-bold ${
                  design.tint === c.value
                    ? "border-accent bg-accent text-ink"
                    : "border-white/15 text-foreground/80"
                }`}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="outline"
          onClick={() => void saveDesign()}
          disabled={saving}
          className="w-full h-11 rounded-xl border border-white/15 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {tx("Save design")}
        </Button>
      </section>

      {/* Before/after + delning */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-slate p-4">
        <div className="text-mono-caps text-[10px] text-muted-foreground">
          {tx("Before / after for the client")}
        </div>
        <Button variant="outline"
          onClick={() => void renderBeforeAfter()}
          disabled={rendering}
          className="mt-2 w-full h-11 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {rendering ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Film className="size-4" />
          )}
          {tx("Generate before/after")}
        </Button>
        {project.before_url && project.after_url && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <img
              src={project.before_url}
              alt={tx("Before")}
              className="rounded-xl border border-white/10"
            />
            <img
              src={project.after_url}
              alt={tx("After")}
              className="rounded-xl border border-white/10"
            />
          </div>
        )}

        <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={project.publish_approved}
            onChange={(e) => void patch({ publish_approved: e.target.checked })}
            className="size-4 accent-accent"
          />
          {tx("Client approves publishing in my portfolio")}
        </label>

        <div className="mt-4 space-y-2">
          <Button variant="outline"
            onClick={() => void shareLink(link, `Your design from ${project.title}`)}
            className="w-full h-11 rounded-xl border border-white/15 font-bold text-sm flex items-center justify-center gap-2"
          >
            <Send className="size-4" />{" "}{tx("Send preview link")}
          </Button>
          <Button variant="outline"
            onClick={async () => {
              await copyToClipboard(link);
              toast.success(tx("Preview link copied"));
            }}
            className="w-full h-11 rounded-xl border border-white/15 font-bold text-sm flex items-center justify-center gap-2"
          >
            <Copy className="size-4" />{" "}{tx("Copy preview link")}
          </Button>
          {!project.client_user_id && (
            <Button variant="outline"
              onClick={async () => {
                await copyToClipboard(inviteLink(project.invite_token));
                toast.success(tx("Invite link copied"));
              }}
              className="w-full h-11 rounded-xl border border-white/15 font-bold text-sm flex items-center justify-center gap-2"
            >
              <Copy className="size-4" />{" "}{tx("Copy invite link")}
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground">
            {tx("The preview link shows the design without voting — the client can leave comments directly on the page.")}
          </p>
        </div>
      </section>
    </StudioShell>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-mono-caps text-[10px] text-muted-foreground">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[color:var(--color-accent,#8A5BF2)]"
      />
    </label>
  );
}
