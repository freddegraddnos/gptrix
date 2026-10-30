import { Link } from "@tanstack/react-router";
import { Layers, PenTool, Shapes, Type, Upload, Wand2, Store, ScanLine } from "lucide-react";
import type { ComponentType } from "react";
import { setPaintReturnTo, requestPaintMotifLibrary, requestPaintStencil } from "@/lib/paintHandoff";

import { tx, useUiLang } from "@/lib/uiLang";
const RETURN = "/artists/dashboard?tab=skapa";

type Tool = { to: string; Icon: ComponentType<{ className?: string }>; title: string; text: string; onClick?: () => void; search?: Record<string, unknown> };

const TOOLS: Tool[] = [
  { to: "/try-it-on", Icon: Upload, title: "Upload sketch", text: "Upload a drawing or photo and remove the background." },
  { to: "/rita", Icon: PenTool, title: "Drawing tool", text: "Brushes, layers, stencils and 1:1 printing.", onClick: () => setPaintReturnTo(RETURN) },
  { to: "/rita", Icon: Shapes, title: "Motif + text", text: "Start from a motif, add text and draw over it.", onClick: () => { setPaintReturnTo(RETURN); requestPaintMotifLibrary(); } },
  { to: "/rita", Icon: ScanLine, title: "Stencil maker", text: "Turn a sketch or photo into clean stencil lines and print at 1:1.", onClick: () => { setPaintReturnTo(RETURN); requestPaintStencil(); } },
  { to: "/tattoo-font-generator", Icon: Type, title: "Text tool", text: "Names, dates and quotes in real tattoo fonts." },
  { to: "/sleeve-builder", Icon: Layers, title: "Sleeve creator", text: "Combine several designs into one sleeve." },
  { to: "/generator", Icon: Wand2, title: "AI creator", text: "Describe an idea and get a first version." },
  { to: "/shop/new", Icon: Store, title: "Sell a design", text: "Put a finished design on the marketplace." },
];

/** Studio → Create: the same design tools customers use. */
export function StudioCreateTools() {
  useUiLang();
  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map(({ to, Icon, title, text, onClick }) => (
        <Link key={title} to={to} onClick={onClick} className="group flex gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span>
          <span className="min-w-0">
            <span className="block font-display text-lg uppercase leading-tight">{tx(title)}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{tx(text)}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
