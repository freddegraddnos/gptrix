import { memo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, Compass, PenTool, User } from "lucide-react";

import { useUiLang } from "@/lib/uiLang";
import { SV } from "@/lib/i18n/sv";
const ITEMS = [
  { to: "/ar", label: "Try", icon: Camera, match: ["/", "/ar", "/photo-tryon"] },
  { to: "/library", label: "Discover", icon: Compass, match: ["/discover", "/library", "/shop", "/studios", "/community"] },
  { to: "/create", label: "Create", icon: PenTool, match: ["/create", "/sleeve-builder", "/tattoo-font-generator", "/generator", "/rita"] },
  { to: "/profile", label: "Profile", icon: User, match: ["/profile", "/bookings", "/my-designs", "/artists"] },
] as const;

function BottomNavImpl() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lang = useUiLang();
  const labelFor = (label: string) => lang === "sv" ? (SV[label] ?? label) : label;
  const compact = pathname === "/ar" || pathname === "/arv2";

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40">
      <div className="mx-auto max-w-md px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-4 rounded-full border-2 border-foreground bg-background/95 backdrop-blur-xl p-1">
          {ITEMS.map(({ to, label, icon: Icon, match }) => {
            const active = match.some((m) =>
              m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(m + "/"),
            );
            return (
              <Link
                key={to}
                to={to}
                aria-label={labelFor(label)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 rounded-full ${compact ? "py-1.5" : "py-2"} transition-colors ${
                  active ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                {!compact && <span className="text-[10px] uppercase tracking-widest leading-none">{labelFor(label)}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export const BottomNav = memo(BottomNavImpl);
