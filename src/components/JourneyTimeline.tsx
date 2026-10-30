import { useMemo, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  JOURNEY_KINDS,
  composeAiToRealCollage,
  sortJourney,
  stepLabel,
  type JourneyKind,
  type JourneyStep,
} from "@/lib/journeyCollage";
import { dataUrlToBlob, downloadBlob, shareFile } from "@/lib/share";
import type { ProjectAsset } from "@/hooks/useProjectWorkspace";

import { tx, useUiLang } from "@/lib/uiLang";
/**
 * Timeline for a project: Idea #1 → Idea #2 → … → Final Design → Actual Tattoo.
 * Steps are stored as project_assets with kind "idea" | "final_design" | "real".
 */
export function JourneyTimeline({
  projectName,
  assets,
  uploading,
  isPublic,
  onUpload,
  onRemove,
  onTogglePublic,
}: {
  projectName: string;
  assets: ProjectAsset[];
  uploading: boolean;
  isPublic: boolean;
  onUpload: (file: File, kind: JourneyKind) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onTogglePublic: (next: boolean) => void | Promise<void>;
}) {
  useUiLang();
  const [collage, setCollage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo<JourneyStep[]>(
    () =>
      sortJourney(
        assets.filter((a) =>
          ["idea", "final_design", "real"].includes(a.kind),
        ) as JourneyStep[],
      ),
    [assets],
  );

  const design =
    steps.filter((s) => s.kind === "final_design").slice(-1)[0] ??
    steps.filter((s) => s.kind === "idea").slice(-1)[0] ??
    null;
  const real = steps.filter((s) => s.kind === "real").slice(-1)[0] ?? null;

  const makeCollage = async () => {
    if (!design || !real) return;
    setBusy(true);
    setError(null);
    try {
      const url = await composeAiToRealCollage({
        designUrl: design.image_url,
        realUrl: real.image_url,
        title: projectName,
      });
      setCollage(url);
    } catch {
      setError(tx("Could not create the collage. Try different images."));
    } finally {
      setBusy(false);
    }
  };

  const addTile = (kind: JourneyKind, label: string) => (
    <label className="flex-none w-24 h-24 rounded-xl border-2 border-dashed border-white/20 grid place-items-center cursor-pointer text-muted-foreground">
      {uploading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <span className="flex flex-col items-center gap-1">
          <Plus className="size-4" />
          <span className="text-[9px] uppercase font-bold text-center leading-tight px-1">
            {label}
          </span>
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUpload(f, kind);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {steps.map((s, i) => (
            <figure key={s.id} className="flex-none w-24">
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-slate">
                <img
                  src={s.image_url}
                  alt={stepLabel(steps, i)}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => void onRemove(s.id)}
                  aria-label={tx("Remove step")}
                  className="absolute top-1 right-1 size-6 rounded-full bg-ink/80 grid place-items-center"
                >
                  <Trash2 className="size-3" />
                </button>
                {s.kind === "real" && (
                  <span className="absolute bottom-1 left-1 rounded-full bg-accent text-ink text-[8px] font-bold px-1.5 py-0.5">
                    {tx("REAL")}
                  </span>
                )}
              </div>
              <figcaption className="mt-1 text-[10px] font-bold text-center">
                {stepLabel(steps, i)}
              </figcaption>
              <div className="text-[9px] text-muted-foreground text-center">
                {new Date(s.created_at).toLocaleDateString("en-US")}
              </div>
            </figure>
          ))}
          {addTile("idea", "New idea")}
        </div>
        {steps.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            {tx("Build your journey: add ideas along the way, then the final design, and finally a photo of the actual tattoo.")}
          </p>
        )}
      </div>

      {/* Quick buttons for final design / actual tattoo */}
      <div className="grid grid-cols-2 gap-2">
        {JOURNEY_KINDS.filter((k) => k.value !== "idea").map((k) => (
          <label
            key={k.value}
            className="rounded-xl border border-white/15 bg-slate p-3 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              {k.value === "real" ? (
                <Check className="size-3.5 text-accent" />
              ) : (
                <Sparkles className="size-3.5 text-accent" />
              )}
              {k.value === "real" ? tx("Add final result") : tx("Final design")}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{k.hint}</p>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f, k.value);
                e.target.value = "";
              }}
            />
          </label>
        ))}
      </div>

      {/* AI → REAL collage */}
      <div className="rounded-2xl border border-white/10 bg-slate p-4">
        <div className="text-mono-caps text-[10px] text-muted-foreground">
          {tx("AI → REAL")}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {design && real
            ? tx("Create a shareable comparison image of the design and the actual tattoo.")
            : tx("Add both a design and a photo of the actual tattoo to create the comparison image.")}
        </p>
        <button
          onClick={() => void makeCollage()}
          disabled={!design || !real || busy}
          className="mt-3 w-full h-11 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {tx("Create comparison image")}
        </button>
        {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

        {collage && (
          <div className="mt-3">
            <img
              src={collage}
              alt={tx("AI to real tattoo")}
              className="w-full rounded-xl border border-white/10"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const blob = await dataUrlToBlob(collage);
                  await shareFile(blob, "inksimulator-ai-to-real.png", {
                    text: tx("From idea to ink — created with InkSimulator."),
                  });
                }}
                className="h-11 rounded-xl bg-accent text-ink font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5"
              >
                <Share2 className="size-3.5" />{" "}{tx("Share")}
              </button>
              <button
                onClick={async () => {
                  const blob = await dataUrlToBlob(collage);
                  downloadBlob(blob, "inksimulator-ai-to-real.png");
                }}
                className="h-11 rounded-xl border border-white/15 font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5"
              >
                <Download className="size-3.5" />{" "}{tx("Save")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Public toggle */}
      <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate p-4">
        <span>
          <span className="text-[12px] font-bold">{tx("Show journey on my profile")}</span>
          <span className="block text-[10px] text-muted-foreground">
            {tx("The timeline appears on your public profile.")}
          </span>
        </span>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => void onTogglePublic(e.target.checked)}
          className="size-5 accent-[color:var(--color-accent,#8A5BF2)]"
        />
      </label>
    </div>
  );
}
