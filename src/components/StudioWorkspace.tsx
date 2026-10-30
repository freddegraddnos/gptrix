import type { ReactNode } from "react";
import { StudioShell } from "@/components/StudioShell";
import type { StudioTab } from "@/lib/studioNav";

export type { StudioTab } from "@/lib/studioNav";
export type { StudioLang } from "@/lib/studioLang";

/** Dashboard sections rendered inside the shared studio shell. */
export function StudioWorkspace({ name, approved, handle, tab, onTabChange, onReturnToGuide, guideStep, onSignOut, action, children }: {
  name: string; approved: boolean; handle?: string | null; userId: string;
  tab: StudioTab; onTabChange: (tab: StudioTab) => void;
  guideStep?: number | null; onReturnToGuide?: () => void;
  onSignOut: () => void; copied?: boolean; onCopy?: () => void; action?: ReactNode; children: ReactNode;
}) {
  return <StudioShell
    current={tab}
    studio={{ name, handle, approved }}
    onSelectTab={(next) => { sessionStorage.removeItem("inksimulator.guide-return"); onTabChange(next); }}
    guideStep={tab === "guide" ? null : guideStep}
    onReturnToGuide={onReturnToGuide}
    onSignOut={onSignOut}
    action={action}
  >
    {children}
  </StudioShell>;
}
