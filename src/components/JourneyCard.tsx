import { Flame, Trophy, Zap, Lock } from "lucide-react";
import { useJourney } from "@/hooks/useJourney";

import { tx, useUiLang } from "@/lib/uiLang";
export function JourneyCard() {
  useUiLang();
  const j = useJourney();

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate to-ink p-4 mb-5 overflow-hidden relative">
      <div className="absolute -top-16 -right-16 size-40 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <header className="flex items-center justify-between mb-3 relative">
        <div>
          <div className="flex items-center gap-1.5 text-mono-caps text-[10px] text-accent">
            <Trophy className="size-3" />
            {tx("Tattoo Journey")}
          </div>
          <div className="mt-1 font-display font-bold text-lg leading-tight">
            {tx("Level")}{" "}{j.level} · {j.levelName}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-ink/60 border border-white/10 px-2.5 py-1">
          <Flame className="size-3.5 text-orange-400" />
          <span className="text-xs font-bold">{j.streakDays}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
            {j.streakDays === 1 ? "day" : "days"}
          </span>
        </div>
      </header>

      {/* XP progress */}
      <div className="relative">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {j.xp} / {j.xpForNext}{" "}{tx("XP")}
          </span>
          <span className="text-[10px] text-accent font-bold">{j.progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent transition-all duration-700"
            style={{ width: `${j.progressPct}%` }}
          />
        </div>
      </div>

      {/* Badges */}
      <div className="mt-4 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-mono-caps text-[10px] text-muted-foreground">
            {tx("Badges")}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {j.earnedCount} / {j.badges.length}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {j.badges.map((b) => (
            <div
              key={b.id}
              title={b.earned ? b.label : b.hint}
              className={`aspect-square rounded-xl grid place-items-center border transition-all ${
                b.earned
                  ? "bg-accent/10 border-accent/40 shadow-[0_0_20px_-8px_rgba(138,91,242,0.5)]"
                  : "bg-white/[0.02] border-white/5"
              }`}
            >
              {b.earned ? (
                <span className="text-xl" aria-label={b.label}>
                  {b.icon}
                </span>
              ) : (
                <Lock className="size-3.5 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </div>

      {j.progressPct >= 90 && j.level < 6 && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-accent">
          <Zap className="size-3" />
          {tx("Almost at the next level —")}{" "}{j.xpForNext - j.xp}{" "}{tx("XP left.")}
        </div>
      )}
    </section>
  );
}
