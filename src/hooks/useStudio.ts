import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { studioImageUrls } from "@/lib/studioMedia";
import { requestOpenSlot } from "@/lib/slotRequests";

export type StudioArtist = {
  id: string;
  studio_id: string;
  name: string;
  role: string | null;
  bio: string | null;
  avatar_url: string | null;
  instagram: string | null;
  styles: string[];
  sort_order: number;
  active: boolean;
};

export type StudioGalleryItem = {
  id: string;
  studio_id: string;
  member_id: string | null;
  image_url: string;
  caption: string | null;
  style: string | null;
  created_at: string;
};

export type StudioDeal = {
  id: string;
  studio_id: string;
  member_id: string | null;
  title: string;
  description: string | null;
  discount_percent: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export type StudioSlot = {
  id: string;
  studio_id: string;
  member_id: string | null;
  deal_id: string | null;
  starts_at: string;
  duration_minutes: number;
  price_ore: number | null;
  note: string | null;
  status: string;
  booked_by: string | null;
  booked_at?: string | null;
  client_note?: string | null;
  decline_reason?: string | null;
  proposed_starts_at?: string | null;
  /** Alternative times the studio offered; the client picks one. */
  proposed_options?: string[] | null;
  approved_at?: string | null;
  /** Artist requires the client to attach a 3D body scan for this booking. */
  requires_3d?: boolean;
  /** Delivered 3D scan/model for this booking (private storage). */
  scan_path?: string | null;
  scan_bucket?: string | null;
  scan_name?: string | null;
  scan_note?: string | null;
  scan_by?: string | null;
  scan_delivered_at?: string | null;
};


/** The artists working at a studio. */
export function useStudioTeam(studioId: string | undefined) {
  const [team, setTeam] = useState<StudioArtist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setTeam([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("studio_artists")
      .select("*")
      .eq("studio_id", studioId)
      .order("sort_order")
      .order("created_at");
    setTeam((data ?? []) as StudioArtist[]);
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (input: Partial<StudioArtist> & { name: string }) => {
      if (!studioId) return;
      await supabase.from("studio_artists").insert({
        studio_id: studioId,
        name: input.name,
        role: input.role ?? null,
        bio: input.bio ?? null,
        avatar_url: input.avatar_url ?? null,
        instagram: input.instagram ?? null,
        styles: input.styles ?? [],
        sort_order: team.length,
      });
      await refresh();
    },
    [studioId, team.length, refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<StudioArtist>) => {
      setTeam((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      await supabase.from("studio_artists").update(patch).eq("id", id);
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      setTeam((t) => t.filter((x) => x.id !== id));
      await supabase.from("studio_artists").delete().eq("id", id);
    },
    [],
  );

  return { team, loading, refresh, add, update, remove };
}

/** Photos of finished tattoos, with resolved image URLs. */
export function useStudioGallery(studioId: string | undefined) {
  const [items, setItems] = useState<StudioGalleryItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("studio_gallery")
      .select("*")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as StudioGalleryItem[];
    setItems(rows);
    setUrls(await studioImageUrls(rows.map((r) => r.image_url)));
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (input: { image_url: string; caption?: string; style?: string; member_id?: string | null }) => {
      if (!studioId) return;
      await supabase.from("studio_gallery").insert({
        studio_id: studioId,
        image_url: input.image_url,
        caption: input.caption ?? null,
        style: input.style ?? null,
        member_id: input.member_id ?? null,
      });
      await refresh();
    },
    [studioId, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setItems((x) => x.filter((i) => i.id !== id));
      await supabase.from("studio_gallery").delete().eq("id", id);
    },
    [],
  );

  return { items, urls, loading, refresh, add, remove };
}

/** Short-notice offers and campaigns. */
export function useStudioDeals(studioId: string | undefined, onlyActive = false) {
  const [deals, setDeals] = useState<StudioDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setDeals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("studio_deals")
      .select("*")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false });
    if (onlyActive) q = q.eq("active", true);
    const { data } = await q;
    setDeals((data ?? []) as StudioDeal[]);
    setLoading(false);
  }, [studioId, onlyActive]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (input: Partial<StudioDeal> & { title: string }) => {
      if (!studioId) return;
      await supabase.from("studio_deals").insert({
        studio_id: studioId,
        title: input.title,
        description: input.description ?? null,
        discount_percent: input.discount_percent ?? null,
        member_id: input.member_id ?? null,
        ends_at: input.ends_at ?? null,
      });
      await refresh();
    },
    [studioId, refresh],
  );

  const update = useCallback(async (id: string, patch: Partial<StudioDeal>) => {
    setDeals((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("studio_deals").update(patch).eq("id", id);
  }, []);

  const remove = useCallback(async (id: string) => {
    setDeals((d) => d.filter((x) => x.id !== id));
    await supabase.from("studio_deals").delete().eq("id", id);
  }, []);

  return { deals, loading, refresh, add, update, remove };
}

/**
 * Publicly visible open slots (safe columns only, via the public_slots view)
 * for the studio's public page. Works for anonymous visitors too.
 */
export function usePublicSlots(studioId: string | undefined, upcomingOnly = false) {
  const [slots, setSlots] = useState<StudioSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setSlots([]);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase.rpc("public_slots", { _studio: studioId });
    setError(!!fetchError);
    let rows = (data ?? []) as StudioSlot[];
    if (upcomingOnly) {
      const now = Date.now();
      rows = rows.filter((s) => new Date(s.starts_at).getTime() >= now);
    }
    setSlots(rows);
    setLoading(false);
  }, [studioId, upcomingOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** A signed-in client requests an open slot; the studio approves it later. */
  const claim = useCallback(
    async (id: string, userId: string) => {
      await requestOpenSlot(
        () => supabase
          .from("studio_slots")
          .update({ status: "requested", booked_by: userId, booked_at: new Date().toISOString() })
          .eq("id", id)
          .eq("status", "open")
          .select("id"),
        refresh,
      );
    },
    [refresh],
  );

  return { slots, loading, error, refresh, claim };
}

/** Bookable time slots per artist. */
export function useStudioSlots(studioId: string | undefined, upcomingOnly = false) {
  const [slots, setSlots] = useState<StudioSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("studio_slots")
      .select("*")
      .eq("studio_id", studioId)
      .order("starts_at");
    if (upcomingOnly) q = q.gte("starts_at", new Date().toISOString());
    const { data } = await q;
    setSlots((data ?? []) as StudioSlot[]);
    setLoading(false);
  }, [studioId, upcomingOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (input: {
      starts_at: string;
      duration_minutes: number;
      member_id?: string | null;
      deal_id?: string | null;
      price_ore?: number | null;
      note?: string | null;
      requires_3d?: boolean;
    }) => {
      if (!studioId) return;
      await supabase.from("studio_slots").insert({ studio_id: studioId, ...input });
      await refresh();
    },
    [studioId, refresh],
  );

  const remove = useCallback(async (id: string) => {
    setSlots((s) => s.filter((x) => x.id !== id));
    await supabase.from("studio_slots").delete().eq("id", id);
  }, []);

  /**
   * A signed-in client requests an open slot. The studio has to approve it
   * before the appointment counts as confirmed.
   */
  const claim = useCallback(
    async (id: string, userId: string) => {
      const { error } = await supabase
        .from("studio_slots")
        .update({ status: "requested", booked_by: userId, booked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "open");
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  /** The studio approves or declines a pending request. */
  const decide = useCallback(
    async (id: string, approve: boolean, reason?: string) => {
      const { error } = await supabase
        .from("studio_slots")
        .update(
          approve
            ? {
                status: "booked",
                approved_at: new Date().toISOString(),
                decline_reason: null,
                proposed_starts_at: null,
                proposed_options: [],
              }
            : {
                status: "open",
                booked_by: null,
                booked_at: null,
                client_note: null,
                approved_at: null,
                proposed_starts_at: null,
                proposed_options: [],
                decline_reason: reason?.trim() || null,
              },
        )
        .eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  /**
   * Instead of declining, the studio can propose another time. The slot stays
   * reserved for the same client until they accept or decline the proposal.
   */
  const propose = useCallback(
    async (id: string, newStartsAt: string[], note?: string) => {
      const options = newStartsAt
        .filter(Boolean)
        .map((t) => new Date(t).toISOString())
        .sort();
      if (options.length === 0) throw new Error("Pick at least one time.");
      const { error } = await supabase
        .from("studio_slots")
        .update({
          status: "proposed",
          proposed_starts_at: options[0],
          proposed_options: options,
          decline_reason: note?.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { slots, loading, refresh, add, remove, claim, decide, propose };
}

export type StudioAvailability = {
  id: string;
  studio_id: string;
  member_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  active: boolean;
  requires_3d?: boolean;
};

export type StudioMember = {
  id: string;
  studio_id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  role: "admin" | "artist";
  status: "invited" | "active" | "revoked";
  invite_token: string;
  artist_member_id: string | null;
  created_at: string;
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Recurring weekly opening rules per studio (optionally per artist). */
export function useStudioAvailability(studioId: string | undefined) {
  const [rules, setRules] = useState<StudioAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("studio_availability")
      .select("*")
      .eq("studio_id", studioId)
      .order("weekday")
      .order("start_time");
    setRules((data ?? []) as StudioAvailability[]);
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Adds the same time window to every selected weekday in one go. */
  const addMany = useCallback(
    async (input: {
      weekdays: number[];
      start_time: string;
      end_time: string;
      slot_minutes: number;
      member_id?: string | null;
      requires_3d?: boolean;
    }) => {
      if (!studioId || input.weekdays.length === 0) return;
      const rows = input.weekdays.map((weekday) => ({
        studio_id: studioId,
        member_id: input.member_id ?? null,
        weekday,
        start_time: input.start_time,
        end_time: input.end_time,
        slot_minutes: input.slot_minutes,
        requires_3d: input.requires_3d ?? false,
      }));
      const { error } = await supabase.from("studio_availability").insert(rows);
      if (error) throw error;
      await refresh();
    },
    [studioId, refresh],
  );

  const toggle = useCallback(
    async (id: string, active: boolean) => {
      await supabase.from("studio_availability").update({ active }).eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setRules((r) => r.filter((x) => x.id !== id));
      await supabase.from("studio_availability").delete().eq("id", id);
    },
    [],
  );

  return { rules, loading, refresh, addMany, toggle, remove };
}

/**
 * Turns the weekly rules into concrete bookable slots for the coming
 * `weeks` weeks, skipping times that already exist.
 */
export async function generateSlotsFromRules(
  studioId: string,
  rules: StudioAvailability[],
  weeks: number,
) {
  const active = rules.filter((r) => r.active);
  if (active.length === 0) return 0;
  const { data: existing } = await supabase
    .from("studio_slots")
    .select("starts_at, member_id")
    .eq("studio_id", studioId)
    .gte("starts_at", new Date().toISOString());
  const taken = new Set(
    (existing ?? []).map((e) => `${e.member_id ?? ""}|${new Date(e.starts_at).toISOString()}`),
  );

  const rows: Array<{
    studio_id: string;
    member_id: string | null;
    starts_at: string;
    duration_minutes: number;
    requires_3d: boolean;
  }> = [];
  const now = new Date();
  for (let day = 0; day < weeks * 7; day++) {
    const date = new Date(now);
    date.setDate(now.getDate() + day);
    for (const rule of active) {
      if (date.getDay() !== rule.weekday) continue;
      const [sh, sm] = rule.start_time.split(":").map(Number);
      const [eh, em] = rule.end_time.split(":").map(Number);
      const start = new Date(date);
      start.setHours(sh ?? 0, sm ?? 0, 0, 0);
      const end = new Date(date);
      end.setHours(eh ?? 0, em ?? 0, 0, 0);
      for (let t = new Date(start); t < end; t = new Date(t.getTime() + rule.slot_minutes * 60000)) {
        if (t <= now) continue;
        const key = `${rule.member_id ?? ""}|${t.toISOString()}`;
        if (taken.has(key)) continue;
        taken.add(key);
        rows.push({
          studio_id: studioId,
          member_id: rule.member_id,
          starts_at: t.toISOString(),
          duration_minutes: rule.slot_minutes,
          requires_3d: rule.requires_3d ?? false,
        });
      }
    }
  }
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("studio_slots").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Studio team accounts with admin/artist roles and e-mail invites. */
export function useStudioMembers(studioId: string | undefined) {
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!studioId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("studio_members")
      .select("*")
      .eq("studio_id", studioId)
      .order("created_at");
    setMembers((data ?? []) as StudioMember[]);
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const invite = useCallback(
    async (input: { email: string; role: "admin" | "artist"; display_name?: string }) => {
      if (!studioId) return null;
      const { data, error } = await supabase
        .from("studio_members")
        .insert({
          studio_id: studioId,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          display_name: input.display_name?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return data as StudioMember;
    },
    [studioId, refresh],
  );

  const setRole = useCallback(
    async (id: string, role: "admin" | "artist") => {
      await supabase.from("studio_members").update({ role }).eq("id", id);
      await refresh();
    },
    [refresh],
  );

  const revoke = useCallback(
    async (id: string) => {
      await supabase.from("studio_members").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  return { members, loading, refresh, invite, setRole, revoke };
}

/** Slots the signed-in client has booked, with cancel and reschedule. */
export function useMySlotBookings(userId: string | undefined) {
  const [slots, setSlots] = useState<StudioSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("studio_slots")
      .select("*")
      .eq("booked_by", userId)
      .order("starts_at");
    setSlots((data ?? []) as StudioSlot[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cancel = useCallback(
    async (slotId: string) => {
      const { error } = await supabase
        .from("studio_slots")
        .update({ status: "open", booked_by: null, booked_at: null, client_note: null })
        .eq("id", slotId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  /** The client accepts or declines a new time proposed by the studio. */
  const respondToProposal = useCallback(
    async (slot: StudioSlot, accept: boolean, chosen?: string) => {
      const update = accept
        ? {
            status: "booked",
            starts_at: chosen ?? slot.proposed_starts_at ?? slot.starts_at,
            proposed_starts_at: null,
            proposed_options: [],
            approved_at: new Date().toISOString(),
            decline_reason: null,
          }
        : {
            status: "open",
            booked_by: null,
            booked_at: null,
            client_note: null,
            proposed_starts_at: null,
            proposed_options: [],
            approved_at: null,
          };
      const { error } = await supabase.from("studio_slots").update(update).eq("id", slot.id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { slots, loading, refresh, cancel, respondToProposal };
}
