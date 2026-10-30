import { StudioButton as Button } from "@/components/StudioPrimitives";
import { useState } from "react";
import { CalendarClock, Loader2, Trash2, Wand2 } from "lucide-react";
import {
  useStudioAvailability,
  useStudioTeam,
  generateSlotsFromRules,
  WEEKDAYS,
} from "@/hooks/useStudio";
import { toast } from "sonner";

import { tx, useUiLang } from "@/lib/uiLang";
/**
 * Weekly opening rules: pick the weekdays once and the same window is applied
 * to all of them, then generate real bookable slots for the coming weeks.
 */
export function StudioAvailabilityManager({ studioId }: { studioId: string }) {
  useUiLang();
  const { rules, loading, addMany, toggle, remove } = useStudioAvailability(studioId);
  const { team } = useStudioTeam(studioId);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [member, setMember] = useState("");
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const save = async () => {
    if (days.length === 0) {
      toast.error(tx("Pick at least one weekday."));
      return;
    }
    if (start >= end) {
      toast.error(tx("The end time must be after the start time."));
      return;
    }
    setBusy(true);
    try {
      await addMany({
        weekdays: days,
        start_time: start,
        end_time: end,
        slot_minutes: slotMinutes,
        member_id: member || null,
      });
      toast.success(tx("Opening hours saved."));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the hours.");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const n = await generateSlotsFromRules(studioId, rules, weeks);
      toast.success(
        n === 0 ? "All slots already exist for that period." : `Created ${n} bookable slots.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create slots.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="mt-5 space-y-4">
      <div className="studio-card space-y-3">
        <h3 className="text-mono-caps text-[10px] text-muted-foreground">
          {tx("Weekly opening hours")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => (
            <Button
              key={d}
              type="button"
              onClick={() => toggleDay(i)}
              aria-pressed={days.includes(i)}
              className={`h-9 px-3 rounded-full text-[11px] font-bold uppercase tracking-widest transition ${
                days.includes(i)
                  ? "bg-accent text-ink"
                  : "bg-ink border border-white/10 text-muted-foreground"
              }`}
            >
              {d}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">{tx("From")}</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">{tx("To")}</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">{tx("Slot (min)")}</span>
            <input
              type="number"
              min={15}
              step={15}
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Math.max(15, Number(e.target.value) || 60))}
              className="mt-1 w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-[10px] text-muted-foreground">{tx("Artist")}</span>
          <select
            value={member}
            onChange={(e) => setMember(e.target.value)}
            className="mt-1 w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">{tx("Whole studio")}</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={save}
          disabled={busy}
          className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
          {tx("Apply to selected days")}
        </Button>
      </div>

      <div className="studio-card">
        <h3 className="text-mono-caps text-[10px] text-muted-foreground mb-3">{tx("Your rules")}</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">{tx("Loading…")}</p>
        ) : rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {tx("No hours yet. Pick weekdays above to open up for bookings.")}
          </p>
        ) : (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-ink px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">
                    {WEEKDAYS[r.weekday]} {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.slot_minutes}{" "}{tx("min ·")}{" "}
                    {team.find((t) => t.id === r.member_id)?.name ?? tx("Whole studio")}
                  </div>
                </div>
                <Button
                  onClick={() => toggle(r.id, !r.active)}
                  className={`h-8 px-3 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    r.active ? "bg-accent text-ink" : "border border-white/10 text-muted-foreground"
                  }`}
                >
                  {r.active ? tx("Open") : tx("Closed")}
                </Button>
                <Button
                  onClick={() => remove(r.id)}
                  aria-label={tx("Remove rule")}
                  className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block flex-1">
            <span className="text-[10px] text-muted-foreground">{tx("Repeat for weeks")}</span>
            <input
              type="number"
              min={1}
              max={12}
              value={weeks}
              onChange={(e) => setWeeks(Math.min(12, Math.max(1, Number(e.target.value) || 4)))}
              className="mt-1 w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm outline-none focus:border-accent"
            />
          </label>
          <Button
            onClick={generate}
            disabled={generating || rules.length === 0}
            variant="outline" className="h-11 px-4 rounded-xl border border-accent/40 text-accent font-bold text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {tx("Create slots")}
          </Button>
        </div>
      </div>
    </section>
  );
}
