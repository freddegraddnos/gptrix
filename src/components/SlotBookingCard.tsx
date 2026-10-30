import { useState } from "react";
import { CalendarClock, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StudioSlot } from "@/hooks/useStudio";
import { logSlotEvent, slotEventLabel, useSlotEvents } from "@/lib/slotEvents";
import { notifySlotBooking } from "@/lib/bookings.functions";
import { BookingScanUpload } from "@/components/BookingScanUpload";
import { BookingFiles } from "@/components/BookingFiles";
import { DesignSpecSender } from "@/components/DesignSpecSender";


import { tx, useUiLang } from "@/lib/uiLang";
/**
 * One of the signed-in client's appointments at a studio: request status,
 * proposed times to accept or decline, decline reason and activity log.
 */
export function SlotBookingCard({
  slot,
  artistName,
  onMove,
  moving,
  onCancel,
  cancelBusy,
  respond,
  onChanged,
}: {
  slot: StudioSlot;
  artistName: string;
  onMove: () => void;
  moving: boolean;
  onCancel: () => void;
  cancelBusy: boolean;
  respond: (slot: StudioSlot, accept: boolean, chosen?: string) => Promise<void>;
  onChanged: () => Promise<void> | void;
}) {
  useUiLang();
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);
  const { events, loading: logLoading, refresh: refreshLog } = useSlotEvents(slot.id);

  const proposed = slot.status === "proposed";
  const confirmed = slot.status === "booked";

  const options = slot.proposed_options?.length
    ? slot.proposed_options
    : slot.proposed_starts_at
      ? [slot.proposed_starts_at]
      : [];

  const decideProposal = async (accept: boolean, chosen?: string) => {
    setBusy(true);
    try {
      if (!accept) {
        await notifySlotBooking({ data: { slotId: slot.id, action: "proposal_declined" } });
      }
      await logSlotEvent({
        slotId: slot.id,
        role: "client",
        action: accept ? "proposal_accepted" : "proposal_declined",
        note: accept && chosen ? new Date(chosen).toLocaleString() : null,
      });
      await respond(slot, accept, chosen);
      if (accept) {
        void notifySlotBooking({ data: { slotId: slot.id, action: "proposal_accepted" } });
      }
      toast.success(accept ? "New time accepted — you're booked." : "Proposal declined.");
      await refreshLog();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the booking.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center gap-3">
        <CalendarClock className="size-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {new Date(slot.starts_at).toLocaleString()}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {artistName} · {slot.duration_minutes} min
          </div>
          <div
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
              confirmed
                ? "bg-emerald-500/15 text-emerald-300"
                : proposed
                  ? "bg-accent/15 text-accent"
                  : "bg-amber-500/15 text-amber-300"
            }`}
          >
            {confirmed
              ? tx("Confirmed by studio")
              : proposed
                ? tx("New time proposed")
                : tx("Awaiting approval")}
          </div>
          {slot.requires_3d && (
            <div className="mt-1 text-[11px] text-accent">
              {tx("This artist needs a 3D body scan for this piece —")}{" "}
              {slot.scan_delivered_at
                ? `delivered ${new Date(slot.scan_delivered_at).toLocaleString()}.`
                : tx("upload it below or capture one in Scan my body.")}
            </div>
          )}

          {confirmed && slot.approved_at && (
            <div className="mt-1 text-[11px] text-emerald-300/80">
              {tx("Accepted")}{" "}{new Date(slot.approved_at).toLocaleString()}
            </div>
          )}
          {!confirmed && !proposed && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {tx("This is a request — it becomes a real appointment when the studio accepts it. The time is held for you meanwhile.")}
            </div>
          )}
        </div>
        <button
          onClick={onMove}
          className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-bold uppercase tracking-widest"
        >
          {moving ? tx("Pick a time") : tx("Move")}
        </button>
        <button
          disabled={cancelBusy}
          onClick={onCancel}
          className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-destructive disabled:opacity-50"
        >
          {tx("Cancel")}
        </button>
      </div>

      <BookingFiles
        slotId={slot.id}
        role="client"
        requires3d={slot.requires_3d}
        scanDeliveredAt={slot.scan_delivered_at}
      />

      {slot.requires_3d ? (
        <BookingScanUpload
          slot={slot}
          role="client"
          onChanged={async () => {
            await refreshLog();
            await onChanged();
          }}
        />
      ) : (
        <DesignSpecSender slotId={slot.id} role="client" />
      )}



      {proposed && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <p className="text-[12px] text-accent">
            {tx("The studio proposed")}{" "}{options.length > 1 ? tx("these alternatives") : tx("another time")}
            {slot.decline_reason ? ` — “${slot.decline_reason}”` : ""}
          </p>
          <ul className="mt-2 space-y-2">
            {options.map((o) => (
              <li key={o} className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold">{new Date(o).toLocaleString()}</span>
                <button
                  disabled={busy}
                  onClick={() => void decideProposal(true, o)}
                  className="rounded-xl bg-accent px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-black disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3 animate-spin" /> : tx("Accept")}
                </button>
              </li>
            ))}
          </ul>
          <button
            disabled={busy}
            onClick={() => void decideProposal(false)}
            className="mt-2 rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive disabled:opacity-50"
          >
            {tx("None of these work")}
          </button>
        </div>
      )}

      {slot.decline_reason && !proposed && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {tx("Message from the studio:")}{" "}{slot.decline_reason}
        </p>
      )}

      <button
        onClick={() => setShowLog((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
      >
        <History className="size-3" /> {showLog ? tx("Hide timeline") : tx("Timeline")}
      </button>
      {showLog && (
        <ul className="mt-2 space-y-1 border-l border-white/10 pl-3">
          {logLoading && <li className="text-[11px] text-muted-foreground">{tx("Loading…")}</li>}
          {slot.requires_3d && (
            <li className="text-[11px] text-muted-foreground">
              <span className="text-accent">{tx("3D body scan required for this booking")}</span>
              {" · "}
              {slot.scan_delivered_at
                ? `delivered ${new Date(slot.scan_delivered_at).toLocaleString()}${
                    slot.scan_name ? ` — ${slot.scan_name}` : ""
                  }`
                : tx("not delivered yet")}
            </li>
          )}
          {!logLoading && events.length === 0 && (
            <li className="text-[11px] text-muted-foreground">
              {tx("Nothing logged yet — your request is the first step.")}
            </li>
          )}

          {events.map((e) => (
            <li key={e.id} className="text-[11px] text-muted-foreground">
              <span className="text-foreground">{slotEventLabel(e)}</span>
              {e.note ? ` — ${e.note}` : ""} ·{" "}
              {new Date(e.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
