import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** InkSimulator commission: 5 % on tattoo payments and new design sales (historic rates retained). */
const TATTOO_RATE = 0.05;
const MOTIF_RATE = 0.05;

export type StudioBalance = {
  studioId: string;
  studioName: string;
  tattooOre: number;
  motifOre: number;
  feeOre: number;
  netOre: number;
  paidOutOre: number;
  owedOre: number;
};

async function balances(admin: any, studioIds?: string[]): Promise<StudioBalance[]> {
  let dq = admin.from("project_deposits").select("studio_id,amount_ore").eq("status", "paid");
  if (studioIds) dq = dq.in("studio_id", studioIds);
  const { data: deps } = await dq;
  const { data: motifs } = await admin.from("marketplace_motifs").select("id,artist_id");
  const artistByMotif = new Map<string, string>((motifs ?? []).map((m: any) => [m.id, m.artist_id]));
  const { data: sales } = await admin.from("motif_purchases").select("motif_id,price_paid_ore,commission_rate");
  let pq = admin.from("studio_payouts").select("studio_id,amount_ore");
  if (studioIds) pq = pq.in("studio_id", studioIds);
  const { data: payouts } = await pq;

  const acc = new Map<string, { t: number; m: number; motifFee: number; p: number }>();
  const get = (id: string) => {
    if (!acc.has(id)) acc.set(id, { t: 0, m: 0, motifFee: 0, p: 0 });
    return acc.get(id)!;
  };
  for (const d of deps ?? []) get(d.studio_id).t += d.amount_ore ?? 0;
  for (const s of sales ?? []) {
    const a = artistByMotif.get(s.motif_id);
    if (a && (!studioIds || studioIds.includes(a))) {
      get(a).m += s.price_paid_ore ?? 0;
      get(a).motifFee += Math.round((s.price_paid_ore ?? 0) * (s.commission_rate ?? MOTIF_RATE));
    }
  }
  for (const p of payouts ?? []) get(p.studio_id).p += p.amount_ore;
  for (const id of studioIds ?? []) get(id);

  const ids = [...acc.keys()];
  const { data: profiles } = ids.length
    ? await admin.from("artist_profiles").select("user_id,studio_name").in("user_id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p: any) => [p.user_id, p.studio_name]));

  return ids
    .map((id) => {
      const v = acc.get(id)!;
      const feeOre = Math.round(v.t * TATTOO_RATE + v.motifFee);
      const netOre = v.t + v.m - feeOre;
      return {
        studioId: id,
        studioName: (nameById.get(id) as string) ?? "Studio",
        tattooOre: v.t,
        motifOre: v.m,
        feeOre,
        netOre,
        paidOutOre: v.p,
        owedOre: netOre - v.p,
      };
    })
    .sort((a, b) => b.owedOre - a.owedOre);
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

export const listStudioBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return balances(supabaseAdmin);
  });

export const recordPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        studioId: z.string().uuid(),
        amountOre: z.number().int().min(1).max(100_000_000),
        note: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("studio_payouts").insert({
      studio_id: data.studioId,
      amount_ore: data.amountOre,
      note: data.note || null,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const getMyStudioBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ studioId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_studio_staff", {
      _studio: data.studioId,
      _user: context.userId,
    });
    if (!ok) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return (await balances(supabaseAdmin, [data.studioId]))[0];
  });
