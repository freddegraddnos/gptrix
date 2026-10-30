import { useMemo, useState } from "react";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStudioDeals, useStudioSlots, useStudioTeam } from "@/hooks/useStudio";
import { notifySlotBooking } from "@/lib/bookings.functions";
import { logSlotEvent } from "@/lib/slotEvents";
import { BookingScanUpload } from "@/components/BookingScanUpload";
import { BookingFiles } from "@/components/BookingFiles";

import { tx, useUiLang } from "@/lib/uiLang";
const fieldCls =
  "w-full h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm outline-none focus:border-accent";

/** Per-artist booking calendar: open slots clients can grab. */
export function StudioCalendarManager({ studioId }: { studioId: string }) {
  useUiLang();
  const { slots, loading, refresh, add, remove, decide, propose } = useStudioSlots(studioId);
  const { team } = useStudioTeam(studioId);
  const { deals } = useStudioDeals(studioId, true);
  const [member, setMember] = useState("");
  const [dealId, setDealId] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("120");
  const [price, setPrice] = useState("");
  const [filter, setFilter] = useState("all");
  const [needs3d, setNeeds3d] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proposeFor, setProposeFor] = useState<string | null>(null);
  const [proposeAt, setProposeAt] = useState<string[]>([""]);
  const [proposeNote, setProposeNote] = useState("");
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const visible = useMemo(
    () => slots.filter((s) => filter === "all" || s.member_id === filter),
    [slots, filter],
  );

  const approve = async (slotId: string, accept: boolean, reason?: string) => {
    try {
      await logSlotEvent({
        slotId,
        role: "studio",
        action: accept ? "booked" : "declined",
        note: accept ? null : reason,
      });
      // Declining clears booked_by, so notify while the client is still attached.
      if (!accept) await notifySlotBooking({ data: { slotId, action: "declined", reason } });
      await decide(slotId, accept, reason);
      if (accept) void notifySlotBooking({ data: { slotId, action: "booked" } });
      toast.success(accept ? "Booking confirmed — the client is notified." : "Request declined.");
      setDeclineFor(null);
      setDeclineReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the request.");
    }
  };

  const sendProposal = async (slotId: string) => {
    const options = proposeAt.filter(Boolean);
    if (options.length === 0) {
      toast.error(tx("Pick at least one time."));
      return;
    }
    try {
      await propose(slotId, options, proposeNote);
      await logSlotEvent({
        slotId,
        role: "studio",
        action: "proposed",
        note: [proposeNote, options.map((o) => new Date(o).toLocaleString()).join(" · ")]
          .filter(Boolean)
          .join(" — "),
      });
      void notifySlotBooking({ data: { slotId, action: "proposed", reason: proposeNote || undefined } });
      toast.success(tx("New time proposed — the client confirms it in their bookings."));
      setProposeFor(null);
      setProposeAt([""]);
      setProposeNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not propose that time.");
    }
  };

  const submit = async () => {
    if (!start) return;
    setBusy(true);
    await add({
      starts_at: new Date(start).toISOString(),
      duration_minutes: Number(duration) || 60,
      member_id: member || null,
      deal_id: dealId || null,
      price_ore: price ? Number(price) * 100 : null,
      requires_3d: needs3d,
    });
    setStart("");
    setPrice("");
    setBusy(false);
  };

  return (
    <section className="mt-5 space-y-3">
      <div className="rounded-2xl border border-white/10 bg-slate p-4 space-y-2">
        <p className="text-sm font-bold">{tx("Open a time slot")}</p>
        <select className={fieldCls} value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">{tx("Any artist")}</option>
          {team.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          className={fieldCls}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">min</span>
            <input
              type="number"
              min={15}
              step={15}
              className="w-full bg-transparent outline-none"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label className="flex flex-1 items-center gap-2 h-11 rounded-xl bg-ink/60 border border-white/10 px-3 text-sm">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">kr</span>
            <input
              type="number"
              min={0}
              className="w-full bg-transparent outline-none"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>
        {deals.length > 0 && (
          <select className={fieldCls} value={dealId} onChange={(e) => setDealId(e.target.value)}>
            <option value="">{tx("No offer attached")}</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
                {d.discount_percent != null ? ` (-${d.discount_percent}%)` : ""}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink/60 px-3 py-2.5 text-xs">
          <input
            type="checkbox"
            checked={needs3d}
            onChange={(e) => setNeeds3d(e.target.checked)}
            className="size-4 accent-[color:var(--accent,#8A5BF2)]"
          />
          <span>
            {tx("Require a 3D body scan with the request")}
            <span className="block text-[10px] text-muted-foreground">
              {tx("For advanced pieces where you need the client's body shape up front.")}
            </span>
          </span>
        </label>
        <button
          onClick={() => void submit()}
          disabled={busy || !start}
          className="w-full h-11 rounded-xl bg-accent text-ink text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {tx("Add slot")}
        </button>
      </div>

      {team.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[{ id: "all", name: "All artists" }, ...team].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold ${
                filter === t.id ? "bg-accent text-ink" : "border border-white/10 bg-slate text-muted-foreground"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {loading && <Loader2 className="mx-auto size-5 animate-spin text-accent" />}
      {!loading && visible.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">{tx("No slots in the calendar yet.")}</p>
      )}

      <ul className="space-y-2">
        {visible.map((s) => (
          <li key={s.id} className="rounded-2xl border border-white/5 bg-slate p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-accent" />
              <span className="font-semibold">{new Date(s.starts_at).toLocaleString()}</span>
              <span
                className={`ml-auto text-[10px] uppercase tracking-widest ${
                  s.status === "booked"
                    ? "text-emerald-400"
                    : s.status === "requested"
                      ? "text-amber-300"
                      : "text-muted-foreground"
                }`}
              >
                {s.status === "requested"
                  ? tx("needs approval")
                  : s.status === "proposed"
                    ? tx("new time proposed")
                    : s.status}
              </span>
              <button onClick={() => void remove(s.id)} aria-label={tx("Remove slot")}>
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {s.member_id ? (team.find((t) => t.id === s.member_id)?.name ?? tx("Artist")) : tx("Any artist")} ·{" "}
              {s.duration_minutes} min
              {s.price_ore != null ? ` · ${Math.round(s.price_ore / 100)} kr` : ""}
              {s.deal_id ? tx(" · offer attached") : ""}
              {s.requires_3d ? tx(" · 3D scan required") : ""}
            </div>
            {s.requires_3d && s.status !== "open" && (
              <BookingScanUpload slot={s} role="studio" onChanged={refresh} />
            )}
            {s.status !== "open" && (
              <BookingFiles
                slotId={s.id}
                role="studio"
                requires3d={s.requires_3d}
                scanDeliveredAt={s.scan_delivered_at}
              />
            )}

            {s.status === "proposed" && (
              <p className="mt-2 text-[11px] text-accent">
                {(s.proposed_options?.length ?? 0) > 1 ? tx("Alternative times proposed: ") : tx("New time proposed: ")}
                {(s.proposed_options?.length
                  ? s.proposed_options
                  : s.proposed_starts_at
                    ? [s.proposed_starts_at]
                    : []
                )
                  .map((o) => new Date(o).toLocaleString())
                  .join(" · ") || "—"}{" "}
                {tx("— waiting for the client to pick one.")}
              </p>
            )}
            {s.status === "requested" && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-amber-300">
                  {tx("A client requested this time — accept to confirm, propose another time, or decline with a reason.")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void approve(s.id, true)}
                    className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-black"
                  >
                    {tx("Accept")}
                  </button>
                  <button
                    onClick={() => setProposeFor(proposeFor === s.id ? null : s.id)}
                    className="rounded-xl border border-accent/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-accent"
                  >
                    {tx("Propose new time")}
                  </button>
                  <button
                    onClick={() => setDeclineFor(declineFor === s.id ? null : s.id)}
                    className="rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive"
                  >
                    {tx("Decline")}
                  </button>
                </div>
                {proposeFor === s.id && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex w-full flex-col gap-2">
                      {proposeAt.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="datetime-local"
                            value={v}
                            onChange={(e) =>
                              setProposeAt((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))
                            }
                            className={`${fieldCls} max-w-[15rem]`}
                            aria-label={`Alternative ${i + 1}`}
                          />
                          {proposeAt.length > 1 && (
                            <button
                              aria-label={tx("Remove this option")}
                              onClick={() => setProposeAt((arr) => arr.filter((_, j) => j !== i))}
                              className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-destructive"
                            >
                              {tx("Remove")}
                            </button>
                          )}
                        </div>
                      ))}
                      {proposeAt.length < 4 && (
                        <button
                          onClick={() => setProposeAt((arr) => [...arr, ""])}
                          className="self-start rounded-lg border border-accent/40 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-accent"
                        >
                          {tx("+ Add alternative")}
                        </button>
                      )}
                    </div>
                    <input
                      value={proposeNote}
                      onChange={(e) => setProposeNote(e.target.value)}
                      placeholder={tx("Message to the client (optional)")}
                      className={`${fieldCls} max-w-[18rem]`}
                    />
                    <button
                      onClick={() => void sendProposal(s.id)}
                      className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-black"
                    >
                      {tx("Send")}{" "}{proposeAt.filter(Boolean).length > 1 ? "alternatives" : "proposal"}
                    </button>
                  </div>
                )}
                {declineFor === s.id && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder={tx("Reason (shown to the client)")}
                      className={`${fieldCls} max-w-[20rem]`}
                    />
                    <button
                      onClick={() => void approve(s.id, false, declineReason)}
                      className="rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive"
                    >
                      {tx("Confirm decline")}
                    </button>
                  </div>
                )}
              </div>
            )}
            {s.decline_reason && s.status !== "requested" && (
              <p className="mt-2 text-[11px] text-muted-foreground">{tx("Note:")}{" "}{s.decline_reason}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
