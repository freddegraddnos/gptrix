import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { tx, useUiLang } from "@/lib/uiLang";
/** Editorial card used by the Create and Discover hubs. */
export function HubCard({
  to,
  onClick,
  Icon,
  kicker,
  title,
  text,
  dark = false,
}: {
  to: string;
  onClick?: () => void;
  Icon: LucideIcon;
  kicker: string;
  title: string;
  text: string;
  dark?: boolean;
}) {
  useUiLang();
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group block rounded-[1.25rem] border-2 border-foreground p-5 transition-transform active:scale-[0.99] ${
        dark ? "bg-foreground text-background" : "bg-card text-foreground"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`text-[10px] uppercase tracking-widest ${dark ? "opacity-70" : "text-muted-foreground"}`}>
          {kicker}
        </span>
        <Icon className={`size-5 shrink-0 ${dark ? "" : "text-accent"}`} />
      </div>
      <div className="mt-6 font-display text-3xl leading-none">{title}</div>
      <p className={`mt-2 text-[12px] leading-snug ${dark ? "opacity-80" : "text-muted-foreground"}`}>{text}</p>
      <div className="mt-4 text-[11px] uppercase tracking-widest group-hover:underline underline-offset-4">
        {tx("Open →")}
      </div>
    </Link>
  );
}

export function HubHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="text-[10px] uppercase tracking-widest text-accent">{kicker}</div>
      <h1 className="mt-1 font-display text-5xl leading-[0.95]">{title}</h1>
      {children && <p className="mt-3 text-[13px] text-muted-foreground leading-snug">{children}</p>}
    </header>
  );
}
