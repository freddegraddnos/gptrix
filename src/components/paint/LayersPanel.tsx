import { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  CornerLeftDown,
  CornerRightUp,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Lock,
  LockOpen,
  PenLine,
  Plus,
  Scissors,
  SlidersHorizontal,
  Sun,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdjustSettings } from "@/lib/paint/adjust";
import type { AdjustLayerKind, BlendMode, LayerInfo } from "@/lib/paint/types";

const ROW = 108; // row height (100) + gap (8)

const BLEND_LABELS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "add", label: "Add" },
];

export function LayersPanel({
  open,
  embedded = false,
  onOpenChange,
  layers,
  activeId,
  onSelect,
  onAdd,
  onAddGroup,
  onAddAdjustment,
  onAdjustChange,
  onDelete,
  onToggleVisible,
  onOpacityChange,
  onReorder,
  onBlendModeChange,
  onToggleAlphaLock,
  onToggleLineLayer,
  onMergeDown,
  onToggleClip,
  onToggleExpanded,
  onUngroup,
  onMoveIntoGroup,
  onMoveOutOfGroup,
}: {
  open: boolean;
  embedded?: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bottom-first, as stored by the engine (groups listed below their children). */
  layers: LayerInfo[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAddGroup: () => void;
  onAddAdjustment: (kind: AdjustLayerKind) => void;
  onAdjustChange: (id: string, patch: Partial<AdjustSettings>) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  /** targetIndex is in the engine's bottom-first order. */
  onReorder: (id: string, targetIndex: number) => void;
  onBlendModeChange: (id: string, mode: BlendMode) => void;
  onToggleAlphaLock: (id: string, locked: boolean) => void;
  onToggleLineLayer: (id: string, isLine: boolean) => void;
  onMergeDown: (id: string) => void;
  onToggleClip: (id: string, clipped: boolean) => void;
  onToggleExpanded: (id: string, expanded: boolean) => void;
  onUngroup: (id: string) => void;
  onMoveIntoGroup: (id: string) => void;
  onMoveOutOfGroup: (id: string) => void;
}) {
  // Displayed top-first, like Procreate.
  const display = [...layers].reverse();
  const [drag, setDrag] = useState<{ id: string; from: number; over: number; dy: number } | null>(
    null,
  );
  const dragRef = useRef<{ id: string; from: number; startY: number } | null>(null);

  const moveDrag = (clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = clientY - d.startY;
    const over = Math.max(0, Math.min(display.length - 1, d.from + Math.round(dy / ROW)));
    setDrag({ id: d.id, from: d.from, over, dy });
  };

  const endDrag = () => {
    const d = dragRef.current;
    const current = drag;
    dragRef.current = null;
    setDrag(null);
    if (!d || !current) return;
    if (current.over !== d.from) {
      // display index -> engine index (bottom-first)
      onReorder(d.id, display.length - 1 - current.over);
    }
  };

  const body = (<>
        <SheetHeader className="flex-row items-center justify-between border-b border-panel-border py-3 pr-14 pl-4">
           {embedded ? <h3 className="text-sm font-medium">Layers</h3> : <SheetTitle className="text-sm font-medium tracking-wide">Layers</SheetTitle>}
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="New adjustment layer"
                  className="flex size-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <SlidersHorizontal size={17} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-panel-border bg-panel">
                <DropdownMenuItem className="text-xs" onSelect={() => onAddAdjustment("hueSat")}>
                  Hue/Saturation
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs"
                  onSelect={() => onAddAdjustment("brightContrast")}
                >
                  Brightness/Contrast
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              aria-label="New group"
              onClick={onAddGroup}
              className="flex size-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <FolderPlus size={17} />
            </button>
            <button
              type="button"
              aria-label="New layer"
              onClick={onAdd}
              className="flex size-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus size={17} />
            </button>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-2 overflow-y-auto p-3">
          {display.map((layer, index) => {
            const isDragged = drag?.id === layer.id;
            const isGroup = layer.kind === "group";
            const isAdjust = layer.kind === "adjust";
            const shift =
              drag && !isDragged
                ? drag.over >= index && drag.from < index
                  ? -ROW
                  : drag.over <= index && drag.from > index
                    ? ROW
                    : 0
                : 0;
            const canMergeDown = layer.canMergeDown;
            const canGroupInto = layer.adjacentGroupId !== null;
            // The imported reference photo: dim it or hide it, nothing else.
            const isLocked = layer.locked;

            return (
              <div
                key={layer.id}
                onClick={() => onSelect(layer.id)}
                style={{
                  marginLeft: layer.depth * 14,
                  transform: isDragged
                    ? `translateY(${drag.dy}px)`
                    : shift
                      ? `translateY(${shift}px)`
                      : undefined,
                  zIndex: isDragged ? 10 : undefined,
                  position: "relative",
                  transition: isDragged ? "none" : "transform 120ms ease",
                }}
                className={`flex h-[100px] cursor-pointer items-center gap-2 rounded-xl border px-2 ${
                  layer.id === activeId
                    ? "border-primary/50 bg-primary/10"
                    : isGroup
                      ? "border-panel-border bg-secondary/50 hover:bg-accent/50"
                      : "border-panel-border bg-card/60 hover:bg-accent/50"
                }`}
              >
                {isLocked ? (
                  <span
                    className="flex size-4 items-center justify-center text-foreground/40"
                    aria-hidden
                  >
                    <Lock size={14} />
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label="Reorder"
                    className="cursor-grab touch-none text-foreground/40 hover:text-foreground/80"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      dragRef.current = { id: layer.id, from: index, startY: e.clientY };
                      setDrag({ id: layer.id, from: index, over: index, dy: 0 });
                    }}
                    onPointerMove={(e) => moveDrag(e.clientY)}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <GripVertical size={16} />
                  </button>
                )}


                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isGroup && (
                      <button
                        type="button"
                        aria-label={
                          layer.expanded ? `Collapse ${layer.name}` : `Expand ${layer.name}`
                        }
                        aria-expanded={layer.expanded}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpanded(layer.id, !layer.expanded);
                        }}
                        className="flex size-5 items-center justify-center rounded text-foreground/60 hover:text-foreground"
                      >
                        {layer.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                    {isAdjust &&
                      (layer.adjustKind === "hueSat" ? (
                        <SlidersHorizontal size={14} className="shrink-0 text-primary" />
                      ) : (
                        <Sun size={14} className="shrink-0 text-primary" />
                      ))}
                    {isGroup ? (
                      layer.expanded ? (
                        <FolderOpen size={14} className="shrink-0 text-foreground/60" />
                      ) : (
                        <Folder size={14} className="shrink-0 text-foreground/60" />
                      )
                    ) : null}
                    <p className="truncate text-sm">{layer.name}</p>
                    {layer.isLine && (
                      <PenLine size={12} className="shrink-0 text-primary" aria-hidden />
                    )}
                    {layer.clipped && (
                      <Scissors size={12} className="shrink-0 text-primary" aria-hidden />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[Math.round(layer.opacity * 100)]}
                      onValueChange={([v]) => onOpacityChange(layer.id, (v ?? 100) / 100)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1"
                    />
                    <span className="w-9 text-right font-mono text-[11px] text-muted-foreground">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                  {isAdjust ? (
                    <div
                      className="mt-1.5 flex flex-col gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(layer.adjustKind === "hueSat"
                        ? ([
                            { key: "hue", label: "Hue", min: -180, max: 180 },
                            { key: "saturation", label: "Sat", min: -100, max: 100 },
                          ] as const)
                        : ([
                            { key: "brightness", label: "Bright", min: -100, max: 100 },
                            { key: "contrast", label: "Contr", min: -100, max: 100 },
                          ] as const)
                      ).map((row) => {
                        const value = layer.adjustSettings?.[row.key] ?? 0;
                        return (
                          <div key={row.key} className="flex items-center gap-2">
                            <span className="w-9 text-[10px] text-muted-foreground">
                              {row.label}
                            </span>
                            <Slider
                              min={row.min}
                              max={row.max}
                              step={1}
                              value={[value]}
                              aria-label={`${row.label} for ${layer.name}`}
                              onValueChange={([v]) => onAdjustChange(layer.id, { [row.key]: v ?? 0 })}
                              className="flex-1"
                            />
                            <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">
                              {Math.round(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : isLocked ? (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Locked reference — adjust visibility, draw on top
                    </p>
                  ) : (
                  <div
                    className="mt-1.5 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}

                  >
                    <Select
                      value={layer.blendMode}
                      onValueChange={(value) => onBlendModeChange(layer.id, value as BlendMode)}
                    >
                      <SelectTrigger
                        aria-label={`Blend mode for ${layer.name}`}
                        className="h-7 flex-1 border-panel-border bg-background/40 px-2 text-[11px]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-panel-border bg-panel">
                        {BLEND_LABELS.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value} className="text-xs">
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <button
                      type="button"
                      aria-label={
                        layer.clipped
                          ? `Remove clipping mask for ${layer.name}`
                          : `Clipping mask for ${layer.name}`
                      }
                      aria-pressed={layer.clipped}
                      disabled={!layer.clipped && !layer.hasSiblingBelow}
                      onClick={() => onToggleClip(layer.id, !layer.clipped)}
                      className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-25 ${
                        layer.clipped
                          ? "bg-primary/20 text-primary"
                          : "text-foreground/50 hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Scissors size={14} />
                    </button>

                    {!isGroup && (
                      <button
                        type="button"
                        aria-label={
                          layer.alphaLocked
                            ? `Unlock alpha for ${layer.name}`
                            : `Alpha lock for ${layer.name}`
                        }
                        aria-pressed={layer.alphaLocked}
                        onClick={() => onToggleAlphaLock(layer.id, !layer.alphaLocked)}
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          layer.alphaLocked
                            ? "bg-primary/20 text-primary"
                            : "text-foreground/50 hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {layer.alphaLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                      </button>
                    )}

                    {!isGroup && (
                      <button
                        type="button"
                        aria-label={
                          layer.isLine
                            ? `Remove line layer for ${layer.name}`
                            : `Mark ${layer.name} as line layer`
                        }
                        aria-pressed={layer.isLine}
                        onClick={() => onToggleLineLayer(layer.id, !layer.isLine)}
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          layer.isLine
                            ? "bg-primary/20 text-primary"
                            : "text-foreground/50 hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <PenLine size={14} />
                      </button>
                    )}

                    {isGroup ? (
                      <button
                        type="button"
                        aria-label={`Ungroup ${layer.name}`}
                        onClick={() => onUngroup(layer.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <FolderOpen size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Merge ${layer.name} down`}
                        disabled={!canMergeDown}
                        onClick={() => onMergeDown(layer.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-25"
                      >
                        <ChevronsDownUp size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      aria-label={`Move ${layer.name} into group`}
                      disabled={!canGroupInto}
                      onClick={() => onMoveIntoGroup(layer.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-25"
                    >
                      <CornerLeftDown size={14} />
                    </button>

                    <button
                      type="button"
                      aria-label={`Move ${layer.name} out of group`}
                      disabled={layer.parentId === null}
                      onClick={() => onMoveOutOfGroup(layer.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-25"
                    >
                      <CornerRightUp size={14} />
                    </button>
                  </div>
                  )}
                  {embedded && !isLocked && <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" size="sm" disabled={index === 0} aria-label={`Move ${layer.name} up`} onClick={() => onReorder(layer.id, layers.length - index)}>↑</Button>
                    <Button variant="ghost" size="sm" disabled={index === display.length - 1} aria-label={`Move ${layer.name} down`} onClick={() => onReorder(layer.id, layers.length - 2 - index)}>↓</Button>
                  </div>}
                </div>

                <button
                  type="button"
                  aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisible(layer.id, !layer.visible);
                  }}
                  className="flex size-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

                <button
                  type="button"
                  aria-label="Delete layer"
                  disabled={layers.length <= 1 || isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(layer.id);
                  }}
                  className="flex size-8 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-25"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
  </>);
  if (embedded) return <div className="paint-mobile-layers">{body}</div>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(340px,100vw)] gap-0 border-panel-border bg-panel/95 p-0 backdrop-blur-xl sm:max-w-[340px]"
      >
        {body}
      </SheetContent>
    </Sheet>
  );
}
