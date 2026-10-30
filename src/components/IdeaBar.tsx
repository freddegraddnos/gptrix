import { Link } from "@tanstack/react-router";
import { ImageIcon, X } from "lucide-react";
import { tx, useUiLang } from "@/lib/uiLang";
import { SIZE_DIMENSIONS, placementFromIdea, type IdeaContext } from "@/lib/ideaContext";

/** Shows which saved idea a studio search or request is linked to. */
export function IdeaBar({ idea, onClear }: { idea: IdeaContext; onClear?: () => void }) {
  useUiLang();
  const dim = SIZE_DIMENSIONS.find((d) => d.value === idea.sizeDimension)?.label;
  const size = idea.widthCm != null ? `${idea.widthCm} cm${dim ? ` (${tx(dim).toLowerCase()})` : ""}` : idea.sizeUnsure ? tx("Size unsure") : null;
  const placement = placementFromIdea(idea) || (idea.placementUnsure ? tx("Placement unsure") : null);
  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-accent/50 bg-card p-2.5">
      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-secondary grid place-items-center">
        {idea.previewUrl ? <img src={idea.previewUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-mono-caps text-[10px] text-accent">{tx("Your idea")}</p>
        <Link to="/projects/$id" params={{ id: idea.id }} className="block truncate text-sm font-bold underline-offset-2 hover:underline">{idea.name}</Link>
        <p className="truncate text-xs text-muted-foreground">{[idea.tattooName, size, placement].filter(Boolean).join(" · ")}</p>
      </div>
      {onClear && (
        <button type="button" onClick={onClear} aria-label={tx("Unlink idea")} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
