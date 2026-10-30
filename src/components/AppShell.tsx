import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({
  children,
  showNav = true,
  fullBleed = false,
  referenceSurface = false,
  studioProfile = false,
  desktopWide = false,
}: {
  children: ReactNode;
  showNav?: boolean;
  fullBleed?: boolean;
  referenceSurface?: boolean;
  studioProfile?: boolean;
  /** Let the page use the full desktop width (phones unchanged). */
  desktopWide?: boolean;
}) {
  return (
    <div className={`min-h-screen text-foreground flex flex-col items-center ${studioProfile ? "studio-visual-profile" : referenceSurface ? "reference-surface" : "calm-surface"}`}>
      <main
        className={`w-full max-w-md ${desktopWide ? "lg:max-w-6xl" : ""} flex-1 ${
          fullBleed ? "" : "px-4 sm:px-6 pt-8"
        } ${showNav ? "pb-[calc(8rem+env(safe-area-inset-bottom))]" : "pb-[calc(2rem+env(safe-area-inset-bottom))]"}`}
      >
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
