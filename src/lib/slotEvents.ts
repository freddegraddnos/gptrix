import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SlotEvent = {
  id: string;
  slot_id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  note: string | null;
  created_at: string;
};

/** Human label for one entry in a booking's activity log. */
export function slotEventLabel(e: SlotEvent): string {
  const who = e.actor_role === "studio" ? "The studio" : "You";
  switch (e.action) {
    case "requested":
      return `${who} requested this time`;
    case "booked":
      return "The studio approved the request";
    case "declined":
      return "The studio declined the request";
    case "proposed":
      return "The studio proposed a new time";
    case "proposal_accepted":
      return "You accepted the new time";
    case "proposal_declined":
      return "You declined the new time";
    case "cancelled":
      return `${who} cancelled the appointment`;
    case "rescheduled":
      return `${who} asked to move the appointment`;
    case "scan_required":
      return "The studio requires a 3D body scan for this piece";
    case "scan_delivered":
      return `${who} delivered the 3D body scan`;
    case "scan_removed":
      return `${who} removed the 3D body scan`;
    case "file_3d_uploaded":
      return `${who} delivered an updated 3D file`;
    case "file_3d_removed":
      return `${who} removed a 3D file`;
    case "file_uploaded":
      return `${who} shared a new artwork file`;
    case "file_removed":
      return `${who} removed an artwork file`;
    case "scan_stage":
      return `3D status updated${e.note ? `: ${e.note.split(" · ")[1] ?? ""}` : ""}`;
    case "notify_result":
      return "Status notification sent";
    case "notify_retry":
      return "Status notification resent";
    case "artwork_delivered":
      return `${who} delivered artwork from the drawing studio`;
    case "design_attached":
      return `${who} attached a saved design from My designs`;
    case "spec_pack_sent":
      return `${who} sent a vector spec pack (SVG, PDF and millimetre measurements)`;


    default:
      return e.action;
  }
}

/** Append an entry to a booking's activity log. Never throws. */
export async function logSlotEvent(input: {
  slotId: string;
  role: "studio" | "client";
  action: string;
  note?: string | null;
}) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("slot_events").insert({
      slot_id: input.slotId,
      actor_id: auth.user.id,
      actor_role: input.role,
      action: input.action,
      note: input.note?.trim() || null,
    });
  } catch (err) {
    console.warn("[slot-events] could not log", err);
  }
}

/** Activity log for one slot, visible to the client and the studio. */
export function useSlotEvents(slotId: string | undefined) {
  const [events, setEvents] = useState<SlotEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!slotId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("slot_events")
      .select("*")
      .eq("slot_id", slotId)
      .order("created_at");
    setEvents((data ?? []) as SlotEvent[]);
    setLoading(false);
  }, [slotId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, loading, refresh };
}
