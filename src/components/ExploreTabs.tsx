import { Link } from "@tanstack/react-router";

import { tx, useUiLang } from "@/lib/uiLang";
/** Discover switch between the design library and studio search; each keeps its own search and filters. */
export function ExploreTabs({ active }: { active: "designs" | "studios" }) {
  useUiLang();
  const item = (to: "/library" | "/studios", label: string, on: boolean) => (
    <Link to={to} aria-current={on ? "page" : undefined}
      className={`flex h-10 flex-1 items-center justify-center rounded-lg text-[13px] font-medium ${on ? "bg-accent text-ink" : "text-muted-foreground"}`}>
      {tx(label)}
    </Link>
  );
  return (
    <nav aria-label={tx("Discover")} className="mb-4 flex rounded-xl border border-white/15 bg-slate p-1">
      {item("/library", "Designs", active === "designs")}
      {item("/studios", "Studios", active === "studios")}
    </nav>
  );
}
