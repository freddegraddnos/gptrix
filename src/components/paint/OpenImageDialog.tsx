import { Image as ImageIcon, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ImagePlacement = "layer" | "background";

/**
 * Asks where a just-picked image should land. The document's size and mm scale
 * are never affected — the photo is fitted inside the existing canvas.
 */
export function OpenImageDialog({
  open,
  fileName,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  fileName?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onChoose: (placement: ImagePlacement) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-panel-border bg-panel/97 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Where should the image go?</DialogTitle>
          <DialogDescription className="text-xs">
            {fileName ? `${fileName} — ` : ""}the canvas size and mm scale won't
            change. The image is fitted into the current document.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => onChoose("layer")}
          className="flex h-12 w-full items-center gap-3 rounded-xl bg-primary/90 px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
        >
          <Layers size={17} /> New layer
        </button>

        <button
          type="button"
          onClick={() => onChoose("background")}
          className="flex h-12 w-full items-center gap-3 rounded-xl border border-panel-border px-4 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ImageIcon size={17} /> Background reference (locked, bottom)
        </button>
      </DialogContent>
    </Dialog>
  );
}
