import type { ReactNode } from "react";
import {
  Brush,
  Eraser,
  Fingerprint,
  Lasso,
  MoreHorizontal,
  MousePointer2,
  Move3d,
  PenLine,
  Pipette,
  Redo2,
  ScanLine,
  Squircle,
  Type,
  Undo2,
  Wand2,
  Maximize,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrushPopoverBody } from "./BrushPopover";

import type { BrushPreset } from "@/lib/paint/brushLibrary";
import type { FeelSettings } from "@/lib/paint/feel";
import type { BrushId } from "@/lib/paint/types";

export type Tool =
  | "select"
  | "brush"
  | "eraser"
  | "smudge"
  | "pipette"
  | "lasso"
  | "rect"
  | "wand"
  | "transform"
  | "text";



function RailButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={`flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-30 ${
            active
              ? "bg-primary/18 text-primary"
              : "text-foreground/65 hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ToolRail({
  tool,
  brushId,
  size,
  opacity,
  feel,
  canUndo,
  canRedo,
  onToolChange,
  onBrushChange,
  onSizeChange,
  onOpacityChange,
  onFeelChange,
  onUndo,
  onRedo,
  onFit,
  onApplyPreset,
  lineViewActive,
  onToggleLineView,
  canCleanToLines,
  lineArtActive,
  onCleanToLines,
}: {
  tool: Tool;
  brushId: BrushId;
  size: number;
  opacity: number;
  feel: FeelSettings;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: Tool) => void;
  onBrushChange: (id: BrushId) => void;
  onSizeChange: (size: number) => void;
  onOpacityChange: (opacity: number) => void;
  onFeelChange: (feel: Partial<FeelSettings>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onApplyPreset: (preset: BrushPreset) => void;
  lineViewActive: boolean;
  onToggleLineView: () => void;
  canCleanToLines: boolean;
  lineArtActive: boolean;
  onCleanToLines: () => void;
}) {
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-panel-border bg-panel/85 p-1.5 shadow-panel backdrop-blur-xl">
      <RailButton
        label="Move (select and move objects)"
        active={tool === "select"}
        onClick={() => onToolChange("select")}
      >
        <MousePointer2 size={19} />
      </RailButton>

      <span className="my-1 h-px w-6 bg-panel-border" />


      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Brush"
            onClick={() => onToolChange("brush")}
            className={`flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              tool === "brush"
                ? "bg-primary/18 text-primary"
                : "text-foreground/65 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Brush size={19} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={12}
          className="w-56 border-panel-border bg-panel/95 backdrop-blur-xl"
        >
          <BrushPopoverBody
            brushId={brushId}
            size={size}
            opacity={opacity}
            feel={feel}
            showBrushList
            onBrushChange={(id) => {
              onBrushChange(id);
              onToolChange("brush");
            }}
            onSizeChange={onSizeChange}
            onOpacityChange={onOpacityChange}
            onFeelChange={onFeelChange}
            onApplyPreset={onApplyPreset}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Eraser"
            onClick={() => onToolChange("eraser")}
            className={`flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              tool === "eraser"
                ? "bg-primary/18 text-primary"
                : "text-foreground/65 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Eraser size={19} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={12}
          className="w-56 border-panel-border bg-panel/95 backdrop-blur-xl"
        >
          <BrushPopoverBody
            brushId={brushId}
            size={size}
            opacity={opacity}
            feel={feel}
            showBrushList
            onBrushChange={onBrushChange}
            onSizeChange={onSizeChange}
            onOpacityChange={onOpacityChange}
            onFeelChange={onFeelChange}
            onApplyPreset={onApplyPreset}
          />
        </PopoverContent>
      </Popover>

      <RailButton
        label="Smudge"
        active={tool === "smudge"}
        onClick={() => onToolChange("smudge")}
      >
        <Fingerprint size={19} />
      </RailButton>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More tools"
            className={`flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              tool === "pipette" || tool === "lasso" || tool === "rect" || tool === "wand"
                ? "bg-primary/18 text-primary"
                : "text-foreground/65 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <MoreHorizontal size={19} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={12}
          className="w-auto border-panel-border bg-panel/95 p-1.5 backdrop-blur-xl"
        >
          <div className="flex flex-col gap-1">
            <RailButton
              label="Eyedropper (pick color)"
              active={tool === "pipette"}
              onClick={() => onToolChange("pipette")}
            >
              <Pipette size={19} />
            </RailButton>
            <RailButton
              label="Select with lasso"
              active={tool === "lasso"}
              onClick={() => onToolChange("lasso")}
            >
              <Lasso size={19} />
            </RailButton>
            <RailButton
              label="Select rectangle"
              active={tool === "rect"}
              onClick={() => onToolChange("rect")}
            >
              <Squircle size={19} />
            </RailButton>
            <RailButton
              label="Magic wand (select by color)"
              active={tool === "wand"}
              onClick={() => onToolChange("wand")}
            >
              <Wand2 size={19} />
            </RailButton>
          </div>
        </PopoverContent>
      </Popover>

      <RailButton
        label="Text (new text layer)"
        active={tool === "text"}
        onClick={() => onToolChange("text")}
      >
        <Type size={19} />
      </RailButton>
      <RailButton
        label="Transform (move, scale, rotate)"
        active={tool === "transform"}
        onClick={() => onToolChange("transform")}
      >
        <Move3d size={19} />
      </RailButton>


      <span className="my-1 h-px w-6 bg-panel-border" />

      <RailButton
        label="Stencil view (show only line layers)"
        active={lineViewActive}
        onClick={onToggleLineView}
      >
        <PenLine size={19} />
      </RailButton>

      <RailButton
        label="Clean to lines (edge detection)"
        active={lineArtActive}
        disabled={!canCleanToLines}
        onClick={onCleanToLines}
      >
        <ScanLine size={19} />
      </RailButton>

      <span className="my-1 h-px w-6 bg-panel-border" />

      <RailButton label="Undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 size={19} />
      </RailButton>
      <RailButton label="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo2 size={19} />
      </RailButton>

      <span className="my-1 h-px w-6 bg-panel-border" />

      <RailButton label="Fit to screen" onClick={onFit}>
        <Maximize size={19} />
      </RailButton>
    </div>
  );
}

