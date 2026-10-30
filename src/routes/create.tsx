import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Type, PenTool, Upload, Wand2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { setPaintReturnTo, requestPaintMotifLibrary } from "@/lib/paintHandoff";
import { seo } from "@/lib/seo";

import { tx, useUiLang } from "@/lib/uiLang";
export const Route = createFileRoute("/create")({
  head: () => seo({ path: "/create", title: tx("Create a Tattoo Design — AI, Upload or Draw | InkSimulator"), description: tx("Create your own tattoo design: describe it to the AI creator, upload a drawing and make the background transparent, or draw and add lettering — then try it on in AR."), breadcrumb: "Create" }),
  component: CreatePage,
});

function CreatePage() {
  useUiLang();
  return (
    <AppShell referenceSurface>
      <header className="mb-7">
        <div className="text-[10px] text-accent">{tx("CREATE")}</div>
        <h1 className="heading-tool mt-3 text-foreground" style={{ textShadow: "none" }}>{tx("MAKE IT YOURS")}</h1>
        <p className="mt-5 font-mono text-xs leading-relaxed text-muted-foreground">{tx("Start with an image, a word or an idea.")}</p>
      </header>
      <div className="grid gap-3.5">
        {[
          { to: "/try-it-on", Icon: Upload, title: tx("UPLOAD A DESIGN"), text: tx("Make the background transparent.") },
          { to: "/tattoo-font-generator", Icon: Type, title: tx("CREATE A TEXT TATTOO"), text: tx("Choose a font. Make it personal.") },
          { to: "/generator", Icon: Wand2, title: tx("CREATE WITH AI"), text: tx("Turn your description into a design."), accountRequired: true },
          { to: "/rita", Icon: PenTool, title: tx("DRAW YOUR DESIGN"), text: tx("Sketch, add lettering and refine."), onClick: () => setPaintReturnTo("/create") },
        ].map(({ to, Icon, title, text, accountRequired, onClick }) => (
          <Link
            key={to}
            to={to}
            onClick={onClick}
            className="group grid min-h-[94px] grid-cols-[24px_minmax(0,1fr)_16px] items-center gap-4 rounded-2xl border border-accent/25 bg-card/85 px-5 py-5 shadow-lg shadow-accent/10 transition-colors hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <Icon aria-hidden="true" className="size-6 shrink-0 text-accent" strokeWidth={1.5} />
            <span className="min-w-0">
              <span className="heading-setting block text-card-foreground" style={{ textShadow: "none" }}>{title}</span>
              <span className="mt-2 block font-mono text-[11px] leading-relaxed text-muted-foreground">{text}</span>
              {accountRequired && <span className="mt-2 block font-mono text-[10px] text-muted-foreground">{tx("Account required")}</span>}
            </span>
            <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-accent" />
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <p className="mb-3 font-mono text-[11px] text-muted-foreground">{tx("Already have a motif in mind?")}</p>
        <Link
          to="/rita"
          onClick={() => {
            setPaintReturnTo("/create");
            requestPaintMotifLibrary();
          }}
          className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0">{tx("Customise a motif")}</span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
        <Link
          to="/sleeve-builder"
          className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0">{tx("Build a sleeve")}</span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      </div>
    </AppShell>
  );
}
