import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Check, GitCompareArrows, ImageIcon, Loader2, MapPin, Upload } from "lucide-react";
import { toast } from "sonner";
import Model3DViewer, { type ScanAnnotation } from "@/components/Model3DViewer";
import { Button } from "@/components/ui/button";
import { StudioButton } from "@/components/StudioPrimitives";
import type { ArtistRequest, SketchAnnotation, SketchVersion } from "@/hooks/useArtistRequests";
import { uploadSketchFile } from "@/hooks/useArtistRequests";
import { addSketchAnnotation, approveSketchVersion, createSketchVersion } from "@/lib/projectRequests.functions";

import { tx, useUiLang } from "@/lib/uiLang";
type Props = { studioMode?: boolean; project: ArtistRequest; sketches: SketchVersion[]; annotations: SketchAnnotation[]; currentUserId: string; onRefresh: () => Promise<void> };
const isModel = (item: SketchVersion) => item.mime_type.includes("gltf") || /\.(glb|gltf)$/i.test(item.file_name);

export function SketchesTab({ studioMode = false, project, sketches, annotations, currentUserId, onRefresh }: Props) {
  useUiLang();
  const SketchButton = studioMode ? StudioButton : Button;
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [changeComment, setChangeComment] = useState("");
  const [pendingPoint, setPendingPoint] = useState<{ kind: "image" | "model"; x: number; y: number; z: number | null } | null>(null);
  const [pointComment, setPointComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [arBusy, setArBusy] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => { if (!selectedId && sketches.length) setSelectedId(project.final_sketch_version_id ?? sketches.at(-1)?.id ?? null); }, [project.final_sketch_version_id, selectedId, sketches]);
  const selected = sketches.find((item) => item.id === selectedId) ?? sketches.at(-1) ?? null;
  const finalVersion = sketches.find((item) => item.id === project.final_sketch_version_id) ?? null;
  const selectedNotes = useMemo(() => annotations.filter((item) => item.version_id === selected?.id), [annotations, selected?.id]);
  const compareVersions = compareIds.map((id) => sketches.find((item) => item.id === id)).filter((item): item is SketchVersion => Boolean(item));

  const upload = async () => {
    if (!file || !changeComment.trim()) return;
    setBusy(true);
    try {
      const uploaded = await uploadSketchFile(project.id, file);
      const version = await createSketchVersion({ data: { projectId: project.id, storagePath: uploaded.path, fileName: file.name, mimeType: uploaded.contentType, sizeBytes: file.size, changeComment: changeComment.trim() } });
      setFile(null); setChangeComment(""); setSelectedId(version.id); await onRefresh(); toast.success(`Sketch ${version.version_number} uploaded`);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not upload sketch"); }
    finally { setBusy(false); }
  };
  const savePoint = async () => {
    if (!selected || !pendingPoint || !pointComment.trim()) return;
    setBusy(true);
    try {
      await addSketchAnnotation({ data: { versionId: selected.id, coordinateKind: pendingPoint.kind, x: pendingPoint.x, y: pendingPoint.y, z: pendingPoint.z, body: pointComment.trim() } });
      setPendingPoint(null); setPointComment(""); await onRefresh(); toast.success(tx("Point comment added"));
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not add comment"); }
    finally { setBusy(false); }
  };
  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    try { await approveSketchVersion({ data: { versionId: selected.id } }); await onRefresh(); toast.success(`Sketch ${selected.version_number} approved`); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not approve sketch"); }
    finally { setBusy(false); }
  };
  const tryFinalInAr = async () => {
    if (!finalVersion?.signed_url || isModel(finalVersion)) return;
    setArBusy(true);
    try {
      const response = await fetch(finalVersion.signed_url);
      if (!response.ok) throw new Error(tx("The final sketch could not be loaded."));
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const previous = sessionStorage.getItem("inkvision.generated.motif");
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      sessionStorage.setItem("inkvision.generated.motif", localUrl);
      await navigate({ to: "/ar", search: { motif: "generated" } as never });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not open this sketch in AR. Please try again.");
      setArBusy(false);
    }
  };
  const pickImagePoint = (event: MouseEvent<HTMLDivElement>) => {
    if (!selected || isModel(selected)) return;
    const image = imageRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    setPendingPoint({ kind: "image", x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, z: null });
  };
  const toggleCompare = (id: string) => setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 2 ? [...current, id] : [current[1], id]);
  const modelNotes: ScanAnnotation[] = selectedNotes.filter((item) => item.coordinate_kind === "model" && item.pos_z !== null).map((item) => ({ id: item.id, body: item.body, x: item.pos_x, y: item.pos_y, z: item.pos_z ?? 0, createdAt: item.created_at, authorName: item.author_id === currentUserId ? "You" : "Project member" }));

  return <div className="space-y-5">
    {finalVersion && <section className="border-y border-accent/30 bg-accent/5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-accent">{tx("Studio's final proposal")}</p><h3 className="mt-1 font-display text-lg font-bold">{tx("Sketch")}{" "}{finalVersion.version_number}</h3></div><span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent"><Check className="size-3" />{tx("Final design")}</span></div>
      {isModel(finalVersion) ? <Model3DViewer modelUrl={finalVersion.signed_url ?? null} className="w-full" /> : finalVersion.signed_url ? <img src={finalVersion.signed_url} alt={`Studio's final proposal, sketch ${finalVersion.version_number}`} className="max-h-[52dvh] min-h-64 w-full rounded-md border border-border bg-secondary object-contain" /> : <div className="grid min-h-64 place-items-center rounded-md border border-border bg-secondary"><ImageIcon className="size-8 text-muted-foreground" /></div>}
      <p className="mt-3 text-xs text-muted-foreground">{finalVersion.change_comment}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><SketchButton variant="outline" onClick={() => setSelectedId(finalVersion.id)}>{tx("View comments and details")}</SketchButton>{!isModel(finalVersion) && <SketchButton disabled={arBusy || !finalVersion.signed_url} onClick={() => void tryFinalInAr()}>{arBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}{tx("Try this sketch in AR")}</SketchButton>}</div>
    </section>}
    {selected ? <>
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-accent">{tx("Sketch")}{" "}{selected.version_number}</p><p className="mt-1 text-xs text-muted-foreground">{selected.change_comment}</p></div>{selected.approved_at && <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent"><Check className="size-3" />{tx("Final design")}</span>}</div>
      {isModel(selected) ? <Model3DViewer modelUrl={selected.signed_url ?? null} annotations={modelNotes} onAddAnnotation={(point) => { setPendingPoint({ kind: "model", ...point }); }} className="w-full" /> : <div className="relative overflow-hidden rounded-md border border-border bg-secondary" onClick={pickImagePoint} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && imageRef.current) { const rect = imageRef.current.getBoundingClientRect(); setPendingPoint({ kind: "image", x: 0.5, y: 0.5, z: null }); if (rect.width === 0 || rect.height === 0) setPendingPoint(null); } }} role="button" tabIndex={0} aria-label={tx("Add a point comment to this sketch")}>
        {selected.signed_url ? <img ref={imageRef} src={selected.signed_url} alt={`Sketch ${selected.version_number}`} className="max-h-[52dvh] min-h-64 w-full object-contain" /> : <div className="grid min-h-64 place-items-center"><ImageIcon className="size-8 text-muted-foreground" /></div>}
        {selectedNotes.filter((item) => item.coordinate_kind === "image").map((item, index) => <span key={item.id} className="pointer-events-none absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground shadow" style={{ left: `${item.pos_x * 100}%`, top: `${item.pos_y * 100}%` }}>{index + 1}</span>)}
        {pendingPoint?.kind === "image" && <span className="pointer-events-none absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground" style={{ left: `${pendingPoint.x * 100}%`, top: `${pendingPoint.y * 100}%` }}><MapPin className="size-3" /></span>}
      </div>}
      {pendingPoint && <div className="rounded-md border border-accent/30 bg-accent/5 p-3"><p className="mb-2 text-xs font-bold">{tx("Comment on this point")}</p><textarea rows={3} value={pointComment} onChange={(event) => setPointComment(event.target.value)} placeholder={tx("Describe the requested change…")} className="w-full rounded-md border border-border bg-secondary p-3 text-sm" /><div className="mt-2 flex gap-2"><SketchButton size="sm" disabled={busy || !pointComment.trim()} onClick={() => void savePoint()}><MapPin className="size-4" />{tx("Save comment")}</SketchButton><SketchButton size="sm" variant="ghost" onClick={() => { setPendingPoint(null); setPointComment(""); }}>{tx("Cancel")}</SketchButton></div></div>}
      {selectedNotes.length > 0 && <div className="divide-y divide-border border-y border-border">{selectedNotes.map((item, index) => <div key={item.id} className="flex gap-3 py-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">{index + 1}</span><div><p className="text-sm">{item.body}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.author_id === currentUserId ? tx("You") : tx("Project member")} · {new Date(item.created_at).toLocaleString()}</p></div></div>)}</div>}
      <div className="grid grid-cols-2 gap-2"><SketchButton variant="outline" disabled={sketches.length < 2} onClick={() => setCompareOpen((value) => !value)}><GitCompareArrows className="size-4" />{tx("Compare")}</SketchButton><SketchButton disabled={busy || Boolean(selected.approved_at)} onClick={() => void approve()}><Check className="size-4" />{selected.approved_at ? tx("Approved") : tx("Approve this version")}</SketchButton></div>
    </> : <div className="border-y border-dashed border-border py-12 text-center"><ImageIcon className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{tx("No sketch versions yet.")}</p></div>}
    {compareOpen && <section className="space-y-3 border-y border-border py-4"><div className="flex items-center justify-between"><h3 className="font-bold">{tx("Compare versions")}</h3><span className="text-[10px] text-muted-foreground">{tx("Choose two below")}</span></div><div className="grid grid-cols-2 gap-2">{compareVersions.map((item) => <SketchPreview key={item.id} item={item} />)}{Array.from({ length: 2 - compareVersions.length }).map((_, index) => <div key={index} className="grid aspect-square place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">{tx("Select a sketch")}</div>)}</div></section>}
    {sketches.length > 0 && <div className="flex gap-3 overflow-x-auto pb-2">{sketches.map((item) => <div key={item.id} className="w-28 shrink-0"><SketchButton type="button" variant="ghost" onClick={() => setSelectedId(item.id)} className={`relative block aspect-square h-auto w-full overflow-hidden rounded-md border p-0 ${selected?.id === item.id ? "border-accent" : "border-border"} bg-secondary`}>{isModel(item) ? <span className="grid size-full place-items-center text-xs font-bold text-accent">3D</span> : item.signed_url ? <img src={item.signed_url} alt={`Sketch ${item.version_number}`} className="size-full object-cover" /> : null}{item.approved_at && <Check className="absolute right-1 top-1 size-4 rounded-full bg-accent p-0.5 text-accent-foreground" />}</SketchButton><div className="mt-1 flex items-center justify-between"><span className="text-[10px] font-bold">{tx("Sketch")}{" "}{item.version_number}</span>{compareOpen && <label className="flex items-center gap-1 text-[9px]"><input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => toggleCompare(item.id)} />{tx("Compare")}</label>}</div></div>)}</div>}
    <section className="border-t border-border pt-5"><h3 className="font-bold">{tx("Upload a new version")}</h3><p className="mt-1 text-xs text-muted-foreground">{tx("Images, GLB or GLTF. Previous versions are never replaced.")}</p><label className="mt-3 flex h-12 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-secondary px-3 text-sm"><Upload className="size-4 text-accent" /><span className="truncate">{file?.name ?? tx("Choose sketch file")}</span><input type="file" accept="image/*,.glb,.gltf,model/gltf-binary,model/gltf+json" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><textarea rows={3} value={changeComment} onChange={(event) => setChangeComment(event.target.value)} placeholder={tx("What changed in this version?")} className="mt-3 w-full rounded-md border border-border bg-secondary p-3 text-sm" /><SketchButton className="mt-2 w-full" disabled={busy || !file || !changeComment.trim()} onClick={() => void upload()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{tx("Upload new version")}</SketchButton></section>
  </div>;
}

function SketchPreview({ item }: { item: SketchVersion }) {
  useUiLang();
  return <div className="overflow-hidden rounded-md border border-border bg-secondary">{isModel(item) ? <Model3DViewer modelUrl={item.signed_url ?? null} className="border-0" /> : item.signed_url ? <img src={item.signed_url} alt={`Sketch ${item.version_number}`} className="aspect-square w-full object-contain" /> : <div className="grid aspect-square place-items-center"><ImageIcon className="size-6 text-muted-foreground" /></div>}<p className="truncate border-t border-border p-2 text-[10px] font-bold">{tx("Sketch")}{" "}{item.version_number}</p></div>;
}