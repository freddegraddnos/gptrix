import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertStaff(context: Ctx, studioId: string) {
  const { data } = await context.supabase.rpc("is_studio_staff", {
    _studio: studioId,
    _user: context.userId,
  });
  if (!data) throw new Error("Only studio team members can do this.");
}

const studioInput = z.object({ studioId: z.string().uuid() });

export const getFortnoxStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => studioInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context, data.studioId);
    const { fortnoxConfig } = await import("@/lib/fortnox.server");
    const { data: raw } = await context.supabase.rpc("studio_fortnox_status", {
      _studio: data.studioId,
    });
    const status = raw as Record<string, any> | null;
    return {
      configured: Boolean(fortnoxConfig()),
      connected: Boolean(status?.connected),
      companyName: (status?.company_name ?? null) as string | null,
      salesAccount: (status?.sales_account ?? 3001) as number,
      vatPercent: (status?.vat_percent ?? 25) as number,
      paymentAccount: (status?.payment_account ?? 1580) as number,
      feeAccount: (status?.fee_account ?? 6570) as number,
    };
  });

export const startFortnoxConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => studioInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context, data.studioId);
    const { fortnoxConfig, signState, authorizeUrl } = await import("@/lib/fortnox.server");
    const cfg = fortnoxConfig();
    if (!cfg) throw new Error("Fortnox is not set up for this app yet.");
    const origin = new URL(getRequest().url).origin;
    return { url: authorizeUrl(cfg.clientId, origin, signState(data.studioId, origin, cfg.clientSecret)) };
  });

export const disconnectFortnox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => studioInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context, data.studioId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("studio_fortnox_links").delete().eq("studio_id", data.studioId);
    return { ok: true };
  });

export const updateFortnoxSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        studioId: z.string().uuid(),
        salesAccount: z.number().int().min(1000).max(9999),
        vatPercent: z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(25)]),
        paymentAccount: z.number().int().min(1000).max(9999),
        feeAccount: z.number().int().min(1000).max(9999),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, data.studioId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("studio_fortnox_links")
      .update({
        sales_account: data.salesAccount,
        vat_percent: data.vatPercent,
        payment_account: data.paymentAccount,
        fee_account: data.feeAccount,
        updated_at: new Date().toISOString(),
      })
      .eq("studio_id", data.studioId);
    if (error) throw error;
    return { ok: true };
  });

async function customerInfo(admin: any, userId: string | null) {
  if (!userId) return { name: "InkSimulator customer", email: null as string | null };
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const { data: p } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return {
    name: (p?.display_name as string) || u?.user?.email || "InkSimulator customer",
    email: (u?.user?.email as string) ?? null,
  };
}

type ExportResult = { invoiceNumber: string } | { error: string };

export const exportToFortnox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ kind: z.enum(["deposit", "motif"]), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<ExportResult> => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { exportSale, COMMISSION } = await import("@/lib/fortnox.server");
    try {
      if (data.kind === "deposit") {
        const { data: d } = await admin
          .from("project_deposits")
          .select("id,project_id,studio_id,amount_ore,status,paid_at,kind,fortnox_invoice_number")
          .eq("id", data.id)
          .maybeSingle();
        if (!d) return { error: "Payment not found." };
        await assertStaff(context, d.studio_id);
        if (d.status !== "paid") return { error: "Only paid payments can be sent." };
        if (d.fortnox_invoice_number) return { invoiceNumber: d.fortnox_invoice_number };
        const { data: project } = await admin
          .from("artist_client_projects")
          .select("title,client_user_id")
          .eq("id", d.project_id)
          .maybeSingle();
        const c = await customerInfo(admin, project?.client_user_id ?? null);
        const invoiceNumber = await exportSale(d.studio_id, {
          customerName: c.name,
          customerEmail: c.email,
          description: `${d.kind === "final" ? "Tattoo" : "Deposit"} — ${project?.title ?? "project"}`,
          amountOre: d.amount_ore,
          commissionRate: COMMISSION.tattoo,
          date: d.paid_at ?? new Date().toISOString(),
          reference: `InkSimulator ${d.id.slice(0, 8)}`,
        });
        await admin
          .from("project_deposits")
          .update({ fortnox_invoice_number: invoiceNumber, fortnox_exported_at: new Date().toISOString() })
          .eq("id", d.id);
        return { invoiceNumber };
      }

      const { data: p } = await admin
        .from("motif_purchases")
        .select("id,user_id,motif_id,price_paid_ore,created_at,commission_rate,fortnox_invoice_number")
        .eq("id", data.id)
        .maybeSingle();
      if (!p) return { error: "Sale not found." };
      const { data: motif } = await admin
        .from("marketplace_motifs")
        .select("name,artist_id")
        .eq("id", p.motif_id)
        .maybeSingle();
      if (!motif?.artist_id) return { error: "Sale not found." };
      await assertStaff(context, motif.artist_id);
      if (p.fortnox_invoice_number) return { invoiceNumber: p.fortnox_invoice_number };
      const c = await customerInfo(admin, p.user_id);
      const invoiceNumber = await exportSale(motif.artist_id, {
        customerName: c.name,
        customerEmail: c.email,
        description: `Design — ${motif.name}`,
        amountOre: p.price_paid_ore ?? 0,
        commissionRate: p.commission_rate ?? COMMISSION.motif,
        date: p.created_at,
        reference: `InkSimulator ${p.id.slice(0, 8)}`,
      });
      await admin
        .from("motif_purchases")
        .update({ fortnox_invoice_number: invoiceNumber, fortnox_exported_at: new Date().toISOString() })
        .eq("id", p.id);
      return { invoiceNumber };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : "Could not send to Fortnox." };
    }
  });
