import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brush, Eraser, Fingerprint, Pipette, MousePointer2, Lasso, Square, Wand2, Move, Type, ImagePlus, Search, Layers, MoreHorizontal, Plus, Minus, Undo2, Redo2, Maximize, Save, ChevronDown, ArrowLeft, Palette, Ruler, Grid2x2, FolderOpen, SlidersHorizontal, Printer, Download, Camera, PenLine, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tx, useUiLang } from "@/lib/uiLang";
import type { Tool } from "./ToolRail";

export function useMobilePaintLayout() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px), (max-height: 500px) and (pointer: coarse)");
    const sync = () => setMobile(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return mobile;
}

const TOOLS = {
  brush: { label: "Brush", icon: Brush }, eraser: { label: "Eraser", icon: Eraser }, smudge: { label: "Smudge", icon: Fingerprint }, pipette: { label: "Eyedropper", icon: Pipette },
  select: { label: "Move", icon: MousePointer2 }, lasso: { label: "Lasso", icon: Lasso }, rect: { label: "Rectangle", icon: Square }, wand: { label: "Magic wand", icon: Wand2 }, transform: { label: "Transform", icon: Move }, text: { label: "Text", icon: Type },
} satisfies Record<Tool, { label: string; icon: typeof Brush }>;
const GROUPS = [{ id: "draw", label: "Draw", icon: Brush }, { id: "insert", label: "Insert", icon: Plus }, { id: "select", label: "Select", icon: MousePointer2 }, { id: "layers", label: "Layers", icon: Layers }, { id: "more", label: "More", icon: MoreHorizontal }] as const;
type Group = typeof GROUPS[number]["id"];
type Panel = "canvas" | "guides" | "adjust" | "stencil" | "print" | "export";
interface Props {
  tool: Tool; onToolChange: (tool: Tool) => void;
  projectName: string; saveStatus: "idle" | "saving" | "saved" | "error";
  onSave: () => void; back: ReactNode;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onFit: () => void; onZoom: (factor: number) => void; zoom: number;
  onPanelHeight: (height: number) => void;
  brush: ReactNode; color: ReactNode; text: ReactNode; layers: ReactNode; context: ReactNode; contextActive: boolean;
  panels: Record<Panel, ReactNode>;
  onImage: () => void; onMotif: () => void; onTemplates: () => void; onHistory: () => void; onStencilMode?: () => void;
  lineView: boolean; onLineView: () => void; canClean: boolean; lineArt: boolean; onClean: () => void;
  onMyDesigns: () => void; onAr: () => void;
  onFullscreen: () => void; onPan: (dx: number, dy: number) => void; onRotate: () => void;
  booking?: { label: string; busy: boolean; onSave: () => void; onDetach: () => void };
}

export function MobilePaintMenu(p: Props) {
  useUiLang();
  const [group, setGroup] = useState<Group | null>(null);
  const [detail, setDetail] = useState<Panel | "color" | null>(null);
  const [contextClosed, setContextClosed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const active = TOOLS[p.tool];
  const contextual = !contextClosed && p.contextActive;
  const open = group !== null || contextual;
  const close = () => { setGroup(null); setDetail(null); setContextClosed(true); opener.current?.focus(); };
  useEffect(() => { setContextClosed(false); }, [p.contextActive, p.tool]);
  useEffect(() => {
    if (!group) return;
    panelRef.current?.querySelector<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')?.focus();
  }, [group, detail]);
  useEffect(() => {
    const element = panelRef.current;
    if (!open || !element) { p.onPanelHeight(0); return; }
    const observer = new ResizeObserver(() => p.onPanelHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, p.onPanelHeight]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Nested dialogs own Escape; canvas transform keeps its existing shortcut.
      if (document.querySelector('[role="dialog"]') || p.tool === "transform") return;
      event.preventDefault(); event.stopPropagation(); close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
  const action = (label: string, Icon: typeof Brush, onClick: () => void, selected = false, disabled = false) => (
    <Button key={label} variant="ghost" disabled={disabled} aria-pressed={selected || undefined} onClick={onClick} className={`h-auto min-h-11 min-w-0 justify-start whitespace-normal px-3 py-2 text-left text-[15px] ${selected ? "bg-secondary text-primary" : "text-foreground"}`}><Icon />{tx(label)}</Button>
  );
  const choose = (tool: Tool) => { p.onToolChange(tool); setDetail(null); };
  const external = (fn: () => void) => { close(); fn(); };
  const title = detail ? ({ canvas: "Canvas and scale", guides: "Drawing guide", adjust: "Adjustments", stencil: "Stencil", print: "Print at 1:1 scale", export: "Export", color: "Color" }[detail]) : GROUPS.find((g) => g.id === group)?.label ?? active.label;
  return <>
    <header className="absolute inset-x-0 top-0 border-b border-panel-border bg-panel px-2 pt-[max(4px,env(safe-area-inset-top))]">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1">
        <div className="paint-mobile-back">{p.back}</div>
        <div className="min-w-0"><p className="truncate text-sm" title={p.projectName}>{p.projectName === "Untitled sketch" ? tx("Untitled sketch") : p.projectName}</p><p role="status" className="text-xs text-muted-foreground">{tx({ idle: "Not saved · this device", saving: "Saving to this device…", saved: "Version saved · this device", error: "Save failed · retry" }[p.saveStatus])}</p></div>
        <Button variant="secondary" onClick={p.onSave} aria-label={tx("Save sketch")} className="h-11 gap-1 px-2 text-[15px]"><Save />{tx("Save")}</Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
        <Button variant="ghost" onClick={(event) => { opener.current = event.currentTarget; setContextClosed(false); setGroup(["lasso", "rect", "wand", "select", "transform"].includes(p.tool) ? "select" : p.tool === "text" ? "insert" : "draw"); }} className="h-11 min-w-0 justify-start gap-1 px-1 text-[13px]"><active.icon /><span className="truncate">{tx(active.label)}</span></Button>
        <div className="flex shrink-0">
          {[{ label: "Undo", icon: Undo2, click: p.onUndo, disabled: !p.canUndo }, { label: "Redo", icon: Redo2, click: p.onRedo, disabled: !p.canRedo }, { label: "Fit to screen", icon: Maximize, click: p.onFit }, { label: "Zoom out", icon: Minus, click: () => p.onZoom(120) }, { label: "Zoom in", icon: Plus, click: () => p.onZoom(-120) }].map((a) => <Button key={a.label} variant="ghost" size="icon" className="size-9" title={tx(a.label)} aria-label={tx(a.label)} disabled={a.disabled} onClick={a.click}><a.icon /></Button>)}
        </div>
      </div>
    </header>
    {open && <section ref={panelRef} id="paint-context" aria-label={tx(title)} className="paint-mobile-panel absolute inset-x-0 bottom-[var(--paint-nav-h)] border-t border-panel-border bg-panel">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2">
        <div className="flex min-w-0 items-center gap-1">{detail && <Button variant="ghost" size="icon" aria-label={tx("Back to tools")} onClick={() => setDetail(null)}><ArrowLeft /></Button>}<h2 className="min-w-0 text-sm">{tx(title)}</h2></div>
        <Button variant="ghost" className="h-11 gap-1 px-2" onClick={close} aria-label={tx("Close tool panel")}><ChevronDown />{tx("Close")}</Button>
      </div>
      <div className="paint-mobile-panel-body px-3 pb-3">
        {detail === "color" ? p.color : detail ? p.panels[detail] : <>
          {group === "draw" && <><div className="grid grid-cols-2 gap-1">{(["brush", "eraser", "smudge", "pipette"] as Tool[]).map((tool) => action(TOOLS[tool].label, TOOLS[tool].icon, () => choose(tool), p.tool === tool))}{action("Color", Palette, () => setDetail("color"))}</div>{["brush", "eraser", "smudge"].includes(p.tool) && <div className="mt-3 border-t border-panel-border pt-3">{p.brush}</div>}</>}
          {group === "insert" && <><div className="grid grid-cols-2 gap-1">{action("Open image", ImagePlus, () => external(p.onImage))}{action("Motifs", Search, () => external(p.onMotif))}{action("Text", Type, () => choose("text"), p.tool === "text")}{action("Templates / import", Ruler, () => external(p.onTemplates))}</div>{p.text}</>}
          {group === "select" && <div className="grid grid-cols-2 gap-1">{(["select", "lasso", "rect", "wand", "transform"] as Tool[]).map((tool) => action(TOOLS[tool].label, TOOLS[tool].icon, () => choose(tool), p.tool === tool))}</div>}
          {group === "layers" && p.layers}
          {group === "more" && <div className="space-y-3">
            <div><h3 className="mb-1 text-sm text-muted-foreground">{tx("Document")}</h3><div className="grid grid-cols-2 gap-1">{action("Canvas and scale", Ruler, () => setDetail("canvas"))}{action("Guides / symmetry", Grid2x2, () => setDetail("guides"))}{action("History / saved sketches", FolderOpen, () => external(p.onHistory))}{action("Fullscreen", Maximize, p.onFullscreen)}{action("Rotate view", Redo2, p.onRotate)}</div><div role="group" aria-label={tx("Move view")} className="mt-2 grid grid-cols-4 gap-1">{[{ label: "Move view left", symbol: "←", x: -40, y: 0 }, { label: "Move view up", symbol: "↑", x: 0, y: -40 }, { label: "Move view down", symbol: "↓", x: 0, y: 40 }, { label: "Move view right", symbol: "→", x: 40, y: 0 }].map((a) => <Button key={a.label} variant="secondary" className="h-11" title={tx(a.label)} aria-label={tx(a.label)} onClick={() => p.onPan(a.x, a.y)}>{a.symbol}</Button>)}</div></div>
            <div><h3 className="mb-1 text-sm text-muted-foreground">{tx("Prepare")}</h3><div className="grid grid-cols-2 gap-1">{action("Adjustments", SlidersHorizontal, () => setDetail("adjust"))}{p.onStencilMode && action("Stencil", Wand2, () => external(p.onStencilMode!))}{action("Stencil view", PenLine, p.onLineView, p.lineView)}{action("Clean to lines", ScanLine, p.onClean, p.lineArt, !p.canClean)}</div></div>
            <div><h3 className="mb-1 text-sm text-muted-foreground">{tx("Results")}</h3><div className="grid grid-cols-2 gap-1">{action("Export", Download, () => setDetail("export"))}{action("Print at 1:1 scale", Printer, () => setDetail("print"))}{action("Try in AR", Camera, () => external(p.onAr))}{action("Save to My designs", Save, p.onMyDesigns)}</div>
              {p.booking && <div className="mt-2 border-t border-panel-border pt-2"><p className="text-sm">{p.booking.label}</p>{action("Save to booking", Save, p.booking.onSave, false, p.booking.busy)}{action("Detach", Minus, p.booking.onDetach)}</div>}
            </div>
          </div>}
          {p.contextActive && group !== "layers" && group !== "insert" && p.context}
        </>}
      </div>
    </section>}
    <nav aria-label={tx("Drawing tools")} className="absolute inset-x-0 bottom-0 grid h-[var(--paint-nav-h)] grid-cols-5 border-t border-panel-border bg-panel pb-[env(safe-area-inset-bottom)]">
      {GROUPS.map((g) => <Button key={g.id} variant="ghost" aria-expanded={group === g.id} aria-controls="paint-context" className={`h-full min-w-0 flex-col gap-0.5 rounded-none px-0 text-[13px] ${group === g.id ? "bg-secondary text-primary" : "text-foreground"}`} onClick={(event) => { if (group === g.id) { close(); return; } opener.current = event.currentTarget; setGroup(g.id); setDetail(null); setContextClosed(false); }}><g.icon />{tx(g.label)}</Button>)}
    </nav>
  </>;
}