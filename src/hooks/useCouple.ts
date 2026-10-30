/**
 * Couple profile — two people who collect their matching tattoo designs
 * together. Backed by `couples`, `couple_members` and `couple_designs`,
 * all locked to the members through row level security.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Couple = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type CoupleMember = {
  id: string;
  user_id: string;
  display_name: string | null;
  joined_at: string;
};

export type CoupleDesign = {
  id: string;
  couple_id: string;
  created_by: string;
  name: string;
  image_data: string;
  width_cm: number | null;
  rotation: number | null;
  note: string | null;
  created_at: string;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeInviteCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
}

export function useCouple() {
  const { user, loading: authLoading } = useAuth();
  const [couple, setCouple] = useState<Couple | null>(null);
  const [members, setMembers] = useState<CoupleMember[]>([]);
  const [designs, setDesigns] = useState<CoupleDesign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setCouple(null);
      setMembers([]);
      setDesigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: mine } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mine) {
      setCouple(null);
      setMembers([]);
      setDesigns([]);
      setLoading(false);
      return;
    }

    const [coupleRes, memberRes, designRes] = await Promise.all([
      supabase.from("couples").select("*").eq("id", mine.couple_id).maybeSingle(),
      supabase
        .from("couple_members")
        .select("id, user_id, display_name, joined_at")
        .eq("couple_id", mine.couple_id)
        .order("joined_at", { ascending: true }),
      supabase
        .from("couple_designs")
        .select("*")
        .eq("couple_id", mine.couple_id)
        .order("created_at", { ascending: false }),
    ]);

    setCouple((coupleRes.data as Couple) ?? null);
    setMembers((memberRes.data as CoupleMember[]) ?? []);
    setDesigns(
      ((designRes.data as CoupleDesign[]) ?? []).map((d) => ({
        ...d,
        width_cm: d.width_cm != null ? Number(d.width_cm) : null,
        rotation: d.rotation != null ? Number(d.rotation) : null,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const createCouple = useCallback(
    async (name: string, displayName: string) => {
      if (!user) throw new Error("Sign in first");
      const { data, error } = await supabase
        .from("couples")
        .insert({
          name: name.trim() || "Our couple",
          invite_code: makeInviteCode(),
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not create the couple");

      const { error: memberError } = await supabase.from("couple_members").insert({
        couple_id: data.id,
        user_id: user.id,
        display_name: displayName.trim() || null,
      });
      if (memberError) throw new Error(memberError.message);
      await load();
      return data as Couple;
    },
    [user, load],
  );

  const joinCouple = useCallback(
    async (code: string, displayName: string) => {
      if (!user) throw new Error("Sign in first");
      const clean = code.trim().toUpperCase();
      // The invite code is validated server-side before the membership is created.
      const { error } = await supabase.rpc("join_couple_by_code", {
        _code: clean,
        _display_name: displayName.trim() || "",
      });
      if (error) {
        if (error.message.includes("invalid_code"))
          throw new Error("No couple found with that code");
        if (error.message.includes("couple_full"))
          throw new Error("That couple is already full");
        throw new Error(error.message);
      }
      await load();
    },
    [user, load],
  );

  const leaveCouple = useCallback(async () => {
    if (!user) return;
    await supabase.from("couple_members").delete().eq("user_id", user.id);
    await load();
  }, [user, load]);

  const renameCouple = useCallback(
    async (name: string) => {
      if (!couple) return;
      await supabase.from("couples").update({ name: name.trim() || couple.name }).eq("id", couple.id);
      await load();
    },
    [couple, load],
  );

  const setDisplayName = useCallback(
    async (displayName: string) => {
      if (!user) return;
      await supabase
        .from("couple_members")
        .update({ display_name: displayName.trim() || null })
        .eq("user_id", user.id);
      await load();
    },
    [user, load],
  );

  const addDesign = useCallback(
    async (input: {
      name: string;
      image: string;
      widthCm?: number | null;
      rotation?: number | null;
      note?: string | null;
    }) => {
      if (!user || !couple) throw new Error("No couple profile");
      const { error } = await supabase.from("couple_designs").insert({
        couple_id: couple.id,
        created_by: user.id,
        name: input.name.trim() || "Matching design",
        image_data: input.image,
        width_cm: input.widthCm ?? null,
        rotation: input.rotation ?? null,
        note: input.note?.trim() || null,
      });
      if (error) throw new Error(error.message);
      await load();
    },
    [user, couple, load],
  );

  const removeDesign = useCallback(
    async (id: string) => {
      await supabase.from("couple_designs").delete().eq("id", id);
      await load();
    },
    [load],
  );

  return {
    user,
    couple,
    members,
    designs,
    loading: loading || authLoading,
    reload: load,
    createCouple,
    joinCouple,
    leaveCouple,
    renameCouple,
    setDisplayName,
    addDesign,
    removeDesign,
  };
}
