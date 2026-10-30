import { Contrast, Type } from "lucide-react";
import { useA11y, setA11y } from "@/lib/journey";

import { tx, useUiLang } from "@/lib/uiLang";
export function AccessibilityCard() {
  useUiLang();
  const p = useA11y();
  return (
    <section className="rounded-2xl border border-white/10 bg-slate p-4 mb-5">
      <div className="text-mono-caps text-[10px] text-muted-foreground mb-3">
        {tx("Accessibility")}
      </div>
      <div className="space-y-2">
        <Toggle
          icon={<Contrast className="size-4" />}
          label={tx("High contrast")}
          hint={tx("Sharper edges and bolder text")}
          on={p.highContrast}
          onChange={(v) => setA11y({ highContrast: v })}
        />
        <Toggle
          icon={<Type className="size-4" />}
          label={tx("Larger text")}
          hint={tx("Increases the base text size across the app")}
          on={p.largeText}
          onChange={(v) => setA11y({ largeText: v })}
        />
      </div>
    </section>
  );
}

function Toggle({
  icon,
  label,
  hint,
  on,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="w-full flex items-center gap-3 rounded-xl border border-white/5 bg-ink px-3 py-2.5 active:scale-[0.98] transition-transform"
      role="switch"
      aria-checked={on}
    >
      <div
        className={`size-9 rounded-lg grid place-items-center shrink-0 ${
          on ? "bg-accent text-ink" : "bg-white/5 text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{hint}</div>
      </div>
      <div
        className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
          on ? "bg-accent" : "bg-white/10"
        }`}
      >
        <div
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}
