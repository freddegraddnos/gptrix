import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { track } from "@/lib/track";
import { deletePhotoTryOnDraft, loadPhotoTryOnDraft, savePhotoTryOnDraft, type PhotoTryOnDraft } from "@/lib/photoTryOnDraft";
import { getMotifRequestContext, motifRequestPath } from "@/lib/motifRequestContext";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  RotateCcw,
  Share2,
  Loader2,
  Download,
  Camera,
  Film,
  CalendarPlus,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { saveProject } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TATTOOS } from "@/lib/tattoos";
import {
  listMyMotifs,
  subscribeMyMotifs,
  type MyMotif,
} from "@/lib/myMotifs";
import { fileToDataUrl } from "@/lib/motifExtract";
import { drawPhotoTattoo, type PhotoPose } from "@/lib/photoTattoo";
import { loadWatermark, drawWatermark } from "@/lib/videoRecording";
import { shareFile, saveToCameraRoll } from "@/lib/share";
import { stashBeforeAfter } from "@/lib/beforeAfterVideo";
import { useMotif } from "@/hooks/useMarketplace";
import { seo } from "@/lib/seo";

import { tx, useUiLang } from "@/lib/uiLang";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/photo-tryon")({
  head: () => seo({ path: "/photo-tryon", title: tx("Photo Tattoo Try-On — Preview Designs on Your Photo | InkSimulator"), description: tx("Upload a photo and preview a tattoo design on your body. Move, resize and rotate the motif, then save or share your InkSimulator try-on."), breadcrumb: "Photo try-on" }),
  validateSearch: (s: Record<string, unknown>) => ({
    motif: typeof s.motif === "string" ? s.motif : undefined,
  }),
  component: PhotoTryOnPage,
});

const START: PhotoPose = { x: 0.5, y: 0.5, scale: 1, rotation: 0, bend: 180 };

function PhotoTryOnPage() {
  useUiLang();
  const { motif: motifParam } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [savingBook, setSavingBook] = useState(false);
  const saveInFlight = useRef(false);
  const saveProjectId = useRef<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<PhotoPose>({ ...START });
  const fileRequest = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const logoRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{ dist: number; angle: number; pose: PhotoPose } | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [availableDraft, setAvailableDraft] = useState<PhotoTryOnDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [photoEl, setPhotoEl] = useState<HTMLImageElement | null>(null);
  const [motifImage, setMotifImage] = useState<{ src: string; image: HTMLImageElement } | null>(null);
  const [motifId, setMotifId] = useState<string>(motifParam ?? TATTOOS[0].id);
  const isMarketplace = UUID_RE.test(motifId);
  const { motif: marketplaceMotif } = useMotif(isMarketplace ? motifId : undefined, user?.id);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [myMotifs, setMyMotifs] = useState<MyMotif[]>([]);
  const [pose, setPose] = useState<PhotoPose>({ ...START });
  // Follow the design in the address when the visitor comes back with another one.
  useEffect(() => { if (motifParam) setMotifId(motifParam); }, [motifParam]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadPhotoTryOnDraft().then((draft) => {
      if (active && fileRequest.current === 0) setAvailableDraft(draft);
    }).catch(() => { if (active) setDraftStatus("error"); });
    return () => { active = false; };
  }, []);

  // Store only on this device; rendering/export and the Live AR engine are unchanged.
  useEffect(() => {
    if (!photo) return;
    saveProjectId.current = undefined;
    let active = true;
    setDraftStatus("saving");
    const timer = window.setTimeout(() => {
      void savePhotoTryOnDraft({ version: 1, photoDataUrl: photo, motifId, pose, updatedAt: Date.now() })
        .then(() => { if (active) setDraftStatus("saved"); })
        .catch(() => { if (active) setDraftStatus("error"); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [photo, motifId, pose]);

  const restoreDraft = () => {
    if (!availableDraft) return;
    const draft = availableDraft;
    const request = ++fileRequest.current;
    const img = new Image();
    img.onload = () => {
      if (request !== fileRequest.current) return;
      setPhotoEl(img);
      setPhoto(draft.photoDataUrl);
      setMotifId(draft.motifId);
      setPose(draft.pose);
      setAvailableDraft(null);
    };
    img.onerror = () => toast.error(tx("Could not read this photo. Try another image."));
    img.src = draft.photoDataUrl;
  };

  const discardDraft = async () => {
    try {
      await deletePhotoTryOnDraft();
      ++fileRequest.current;
      setAvailableDraft(null);
      setPhoto(null);
      setPhotoEl(null);
      setDraftStatus(null);
    } catch {
      toast.error(tx("Could not remove the draft from this device. Try again."));
    }
  };

  useEffect(() => {
    setMyMotifs(listMyMotifs());
    return subscribeMyMotifs(() => setMyMotifs(listMyMotifs()));
  }, []);

  useEffect(() => {
    void loadWatermark().then((img) => {
      logoRef.current = img;
    });
  }, []);

  const motifs = [
    ...myMotifs.map((m) => ({ id: m.id, name: m.name, src: m.src })),
    ...TATTOOS.map((t) => ({ id: t.id, name: t.name, src: t.src })),
    ...(marketplaceMotif?.image_url
      ? [{ id: marketplaceMotif.id, name: marketplaceMotif.name, src: marketplaceMotif.image_url }]
      : []),
  ];
  const current = motifs.find((m) => m.id === motifId);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  /** Still photos use one 2D drawing for the preview and all exports. */
  useEffect(() => {
    if (!photo) return;
    const resize = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      sizeRef.current = { w: Math.round(r.width), h: Math.round(r.height) };
      setViewSize({ ...sizeRef.current });
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => ro.disconnect();
  }, [photo]);

  useEffect(() => {
    if (!current?.src) return;
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (active) setMotifImage({ src: current.src, image });
    };
    image.onerror = () => {
      if (active) toast.error(tx("Could not read this design. Choose another one."));
    };
    image.src = current.src;
    return () => { active = false; };
  }, [current?.src]);

  const readyMotif = motifImage && motifImage.src === current?.src ? motifImage.image : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewSize.w || !viewSize.h) return;
    canvas.width = viewSize.w;
    canvas.height = viewSize.h;
    const ctx = canvas.getContext("2d");
    if (ctx && readyMotif) drawPhotoTattoo(ctx, readyMotif, pose, viewSize.w, viewSize.h);
  }, [photo, pose, readyMotif, viewSize]);

  const onFile = useCallback(async (file?: File | null) => {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      track("photo_uploaded");
      track("tryon_started", { mode: "photo" });
    }
    if (!file.type.startsWith("image/")) {
      toast.error(tx("Choose an image file."));
      return;
    }
    const request = ++fileRequest.current;
    try {
      const url = await fileToDataUrl(file);
      if (request !== fileRequest.current) return;
      const img = new Image();
      img.onload = () => {
        if (request !== fileRequest.current) return;
        setPhotoEl(img);
        setPhoto(url);
        setPose({ ...START });
        setAvailableDraft(null);
      };
      img.onerror = () => toast.error(tx("Could not read this photo. Try another image."));
      img.src = url;
    } catch {
      toast.error(tx("Could not read this photo. Try another image."));
    }
  }, []);

  /* ---- Gestures: drag to move, pinch to resize, twist to rotate ---- */
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        pose: poseRef.current,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { w, h } = sizeRef.current;
    if (pointers.current.size === 1) {
      const dx = (e.clientX - prev.x) / (w || 1);
      const dy = (e.clientY - prev.y) / (h || 1);
      setPose((p) => ({
        ...p,
        x: Math.min(1, Math.max(0, p.x + dx)),
        y: Math.min(1, Math.max(0, p.y + dy)),
      }));
    } else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const g = gesture.current;
      setPose((p) => ({
        ...p,
        scale: Math.min(4, Math.max(0.2, g.pose.scale * (dist / (g.dist || 1)))),
        rotation: g.pose.rotation + (angle - g.angle),
      }));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  /** Draws the photo (+ optional design and branding) on a canvas. */
  const renderFrame = useCallback(
    (withTattoo: boolean, brand: boolean): HTMLCanvasElement | null => {
       if (!photoEl || (withTattoo && !readyMotif)) return null;
      const { w, h } = sizeRef.current;
       if (!w || !h) return null;
      const scale = Math.min(2, 1400 / Math.max(w, h));
      const W = Math.round(w * scale);
      const H = Math.round(h * scale);
      const out = document.createElement("canvas");
      out.width = W;
      out.height = H;
      const ctx = out.getContext("2d");
      if (!ctx) return null;

      // Photo (object-contain, same as in the editor)
      ctx.fillStyle = "#0b0b0d";
      ctx.fillRect(0, 0, W, H);
      const ar = photoEl.width / photoEl.height;
      let dw = W;
      let dh = W / ar;
      if (dh > H) {
        dh = H;
        dw = H * ar;
      }
      ctx.drawImage(photoEl, (W - dw) / 2, (H - dh) / 2, dw, dh);
       if (withTattoo && readyMotif) drawPhotoTattoo(ctx, readyMotif, poseRef.current, W, H);

      if (brand) {
        // "Try yours" CTA + burned-in logo
        const grad = ctx.createLinearGradient(0, H * 0.78, 0, H);
        grad.addColorStop(0, "rgba(5,5,5,0)");
        grad.addColorStop(1, "rgba(5,5,5,0.9)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, H * 0.78, W, H * 0.22);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#8A5BF2";
        ctx.font = `700 ${Math.round(W * 0.035)}px "Space Grotesk", system-ui, sans-serif`;
        ctx.fillText("Try yours →", Math.round(W * 0.05), Math.round(H * 0.925));
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `600 ${Math.round(W * 0.022)}px system-ui, sans-serif`;
        ctx.fillText("inksimulator.com", Math.round(W * 0.05), Math.round(H * 0.962));
        drawWatermark(ctx, W, H, logoRef.current);
      }
      return out;
    },
    [photoEl, readyMotif],
  );

  /** Burns the photo + design + InkSimulator logo into a shareable image. */
  const compose = useCallback(async (): Promise<Blob | null> => {
    const out = renderFrame(true, true);
    if (!out) return null;
    return new Promise((resolve) =>
      out.toBlob((b) => resolve(b), "image/png", 0.95),
    );
  }, [renderFrame]);

  /** Sends the before/after images to the Before/After video generator. */
  const goBeforeAfter = useCallback(() => {
    const before = renderFrame(false, false);
    const after = renderFrame(true, false);
    if (!before || !after) {
          toast.error(tx("Wait for your photo and design to load."));
      return;
    }
    stashBeforeAfter({
      before: before.toDataURL("image/jpeg", 0.92),
      after: after.toDataURL("image/jpeg", 0.92),
    });
    void navigate({ to: "/before-after" });
  }, [renderFrame, navigate]);


  /** Saves the photo with and without the design, then opens booking. */
  const saveAndBook = async () => {
    if (saveInFlight.current) return;
    const after = renderFrame(true, false);
    const before = renderFrame(false, false);
    if (!after || !before) {
      toast.error(tx("Wait for your photo and design to load."));
      return;
    }
    setSavingBook(true);
    saveInFlight.current = true;
    try {
      if (!user) {
        if (!photo) return;
        // Commit the editable draft before leaving. A failed local write must
        // not send the visitor to login and silently discard their work.
        await savePhotoTryOnDraft({ version: 1, photoDataUrl: photo, motifId, pose: poseRef.current, updatedAt: Date.now() });
        void navigate({ to: "/auth", search: { redirect: `/photo-tryon?motif=${encodeURIComponent(motifId)}` } });
        return;
      }
      const name = (current as { name?: string } | undefined)?.name ?? "Photo try-on";
      saveProjectId.current ??= crypto.randomUUID();
      const project = await saveProject({
        projectId: saveProjectId.current,
        userId: user.id,
        name,
        tattooId: motifId,
        tattooName: name,
        previewDataUrl: after.toDataURL("image/jpeg", 0.9),
        basePhotoDataUrl: before.toDataURL("image/jpeg", 0.9),
      });
      const context = getMotifRequestContext(motifId);
      toast.success(tx("Saved to your account. Review your request before sending."));
      if (context) void navigate({ to: `${motifRequestPath(context)}&idea=${encodeURIComponent(project.id)}` as never });
      else void navigate({ to: "/artists/search", search: { project: project.id } as never });
    } catch {
      toast.error(tx("Could not save the photo. Your work is still open here; please try again."));
    } finally {
      saveInFlight.current = false;
      setSavingBook(false);
    }
  };

  const doShare = async () => {
    setBusy(true);
    try {
      const blob = await compose();
      if (!blob) throw new Error("compose");
      const res = await shareFile(blob, "inksimulator-tryon.png", {
        title: tx("My InkSimulator preview"),
        text: tx("Here's how the tattoo would look. Try yours → inksimulator.com"),
      });
      if (res === "downloaded") toast.success(tx("Image saved"));
    } catch {
      toast.error(tx("Could not share the image."));
    } finally {
      setBusy(false);
    }
  };

  const doSave = async () => {
    setBusy(true);
    try {
      const blob = await compose();
      if (!blob) throw new Error("compose");
      await saveToCameraRoll(blob, "inksimulator-tryon.png");
      toast.success(tx("Saved to camera roll"));
    } catch {
      toast.error(tx("Could not save the image."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <header className="mb-5">
        <div className="text-mono-caps text-[10px] text-accent">{tx("Paste on a picture")}</div>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight">
          {tx("Paste tattoo on a picture")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {motifParam
            ? tx("Upload a photo of the body part to try your chosen design.")
            : tx("Upload a photo of your arm, leg, back, or hand and place a design on it.")}
        </p>
        <details className="mt-2 text-sm text-muted-foreground">
          <summary className="cursor-pointer text-xs underline underline-offset-4">{tx("How photo try-on works")}</summary>
          <p className="mt-2">
            {tx("Drag to move, pinch to resize and twist to rotate. This is an approximate visualisation, not a calibrated measurement.")}
          </p>
          <p className="mt-2">
            {tx("Photo try-on is free and needs no app and no account. Pick a design from the library, one you drew yourself or one made with the AI creator, then place it on your own photo to judge size, placement and how it flows with your body. Your photo stays on your device unless you choose to save or share it. When the result feels right, save it, send it to friends for a vote, or send it to an approved tattoo studio with your booking request.")}
          </p>
        </details>
      </header>

      {!photo && availableDraft && (
        <section className="mb-4 rounded-2xl border border-accent/40 bg-slate/60 p-4" aria-label={tx("Saved on this device")}>
          <p className="text-sm font-bold">{tx("Resume your photo try-on")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tx("Your photo and placement are saved only on this device for up to 24 hours. Nothing has been sent to a studio.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={restoreDraft}>{tx("Resume")}</Button>
            <Button variant="ghost" onClick={() => void discardDraft()}>{tx("Remove local draft")}</Button>
          </div>
        </section>
      )}

      {motifParam && current && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate/60 p-3" aria-label={tx("Chosen design")}>
          <div className="size-14 shrink-0 rounded-xl bg-checker p-1"><img src={current.src} alt="" className="h-full w-full object-contain" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{tx("Chosen design")}</div>
            <div className="truncate text-sm font-bold">{current.name}</div>
          </div>
          <Link to="/library" className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold">{tx("Change design")}</Link>
        </div>
      )}

      {!photo && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl border border-dashed border-accent/40 bg-slate/60 p-8 text-center active:scale-[0.99] transition"
          >
            <div className="mx-auto mb-3 size-12 rounded-2xl bg-accent text-ink grid place-items-center">
              <Upload className="size-5" strokeWidth={2.5} />
            </div>
            <div className="font-display font-bold">{tx("Upload a photo of the body part")}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx("JPG or PNG · preferably taken in daylight")}
            </p>
          </button>
          <Link
            to="/ar"
            search={(motifParam ? { motif: motifId } : {}) as never}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate/50 p-4"
          >
            <Camera className="size-5 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{tx("Prefer live?")}</div>
              <p className="text-[11px] text-muted-foreground">
                {tx("Run a real-time try-on with the camera instead.")}
              </p>
            </div>
            <span className="text-accent" aria-hidden>
              →
            </span>
          </Link>
        </section>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {photo && (
        <section className="space-y-4 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p role="status" className="text-muted-foreground">
              {draftStatus === "saved" ? tx("Saved on this device for 24 hours · not sent") : draftStatus === "error" ? tx("Device save failed. Keep this tab open to preserve your work.") : tx("Saving on this device…")}
            </p>
            <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => void discardDraft()}>{tx("Remove local draft")}</button>
          </div>
          <div
            ref={wrapRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            className="relative aspect-[3/4] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-ink"
          >
            <img
              src={photo}
              alt={tx("Your photo of the body part")}
              className="absolute inset-0 h-full w-full object-contain"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {motifs.slice(0, 30).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMotifId(m.id);
                  // design_selected — design picked in the photo try-on strip
                  track("design_selected", { mode: "photo" });
                }}
                aria-label={m.name}
                className={`h-14 w-14 shrink-0 rounded-xl border bg-checker p-1 ${
                  motifId === m.id ? "border-accent" : "border-white/15"
                }`}
              >
                <img src={m.src} alt={m.name} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate/50 p-4">
            <label className="block text-xs font-bold">
              {tx("Size:")}{" "}{Math.round(pose.scale * 100)}%
            </label>
            <input
              type="range"
              min={20}
              max={400}
              value={Math.round(pose.scale * 100)}
              onChange={(e) => setPose((p) => ({ ...p, scale: Number(e.target.value) / 100 }))}
              className="w-full accent-accent"
              aria-label={tx("Size")}
            />
            <label className="block text-xs font-bold">
              {tx("Rotation:")}{" "}{Math.round((pose.rotation * 180) / Math.PI)}°
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              value={Math.round((pose.rotation * 180) / Math.PI)}
              onChange={(e) =>
                setPose((p) => ({ ...p, rotation: (Number(e.target.value) * Math.PI) / 180 }))
              }
              className="w-full accent-accent"
              aria-label={tx("Rotation")}
            />
            <label className="block text-xs font-bold">
              {tx("Skin bend:")}{" "}{pose.bend}°{" "}
              <span className="font-normal text-muted-foreground">
                {tx("(180° = flat surface)")}
              </span>
            </label>
            <input
              type="range"
              min={90}
              max={180}
              value={pose.bend}
              onChange={(e) => setPose((p) => ({ ...p, bend: Number(e.target.value) }))}
              className="w-full accent-accent"
              aria-label={tx("Bend")}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1 rounded-full"
              onClick={() => void doShare()}
              disabled={busy || !readyMotif}
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Share2 className="mr-2 size-4" />
              )}
              {tx("Try yours → Share")}
            </Button>
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => void doSave()}
              disabled={busy || !readyMotif}
            >
              <Download className="mr-2 size-4" />{" "}{tx("Save")}
            </Button>
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={goBeforeAfter}
              disabled={!readyMotif}
            >
              <Film className="mr-2 size-4" />{" "}{tx("Before/After-video")}
            </Button>
            <Button
              className="rounded-full"
              onClick={() => void saveAndBook()}
              disabled={!readyMotif || savingBook}
            >
              {savingBook ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CalendarPlus className="mr-2 size-4" />}{" "}{tx("Save & book")}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => setPose({ ...START })}
            >
              <RotateCcw className="mr-2 size-4" />{" "}{tx("Reset")}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 size-4" />{" "}{tx("New photo")}
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            {tx("Shared images get the InkSimulator logo and \"Try yours →\" burned in.")}
          </p>
        </section>
      )}
    </AppShell>
  );
}
