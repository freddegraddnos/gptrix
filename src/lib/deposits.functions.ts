import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Booking deposits. The studio sets an amount per project, the customer pays it
 * with card through the existing Stripe checkout. Studios can require the
 * deposit before an appointment counts as confirmed.
 */

const MIN_ORE = 5000;
const MAX_ORE = 10_000_000;

export const setProjectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        amountOre: z.number().int().min(MIN_ORE).max(MAX_ORE),
        kind: z.enum(["deposit", "final"]).default("deposit"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project } = await supabase
      .from("artist_client_projects")
      .select("id,artist_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found.");
    const { data: allowed } = await supabase.rpc("is_studio_staff", {
      _studio: project.artist_id,
      _user: userId,
    });
    if (!allowed) throw new Error("Only studio team members can set a deposit.");

    const { data: existing } = await supabase
      .from("project_deposits")
      .select("id,status")
      .eq("project_id", data.projectId)
      .eq("kind", data.kind)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existing?.status === "paid") throw new Error("This payment is already paid.");

    if (existing) {
      const { error } = await supabase
        .from("project_deposits")
        .update({ amount_ore: data.amountOre })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("project_deposits").insert({
        project_id: data.projectId,
        studio_id: project.artist_id,
        amount_ore: data.amountOre,
        kind: data.kind,
        created_by: userId,
      });
      if (error) throw error;
    }

    const { notifyProjectParty } = await import("@/lib/projectNotify.server");
    await notifyProjectParty(
      data.projectId,
      userId,
      data.kind === "final" ? "Payment requested" : "Deposit requested",
      data.kind === "final"
        ? `Pay ${Math.round(data.amountOre / 100)} kr for your tattoo.`
        : `Pay ${Math.round(data.amountOre / 100)} kr to secure your booking.`,
      `${data.kind}-request-${data.projectId}-${data.amountOre}`,
    );
    return { ok: true };
  });

export const cancelProjectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ depositId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("project_deposits")
      .update({ status: "cancelled" })
      .eq("id", data.depositId)
      .eq("status", "unpaid");
    if (error) throw error;
    return { ok: true };
  });

type CheckoutResult = { clientSecret: string } | { error: string };

export const createDepositCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        depositId: z.string().uuid(),
        returnUrl: z.string().url().max(500),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    try {
      const { supabase, userId } = context;
      const { data: deposit } = await supabase
        .from("project_deposits")
        .select("id,project_id,amount_ore,status,kind")
        .eq("id", data.depositId)
        .maybeSingle();
      if (!deposit) return { error: "This deposit is no longer available." };
      if (deposit.status !== "unpaid") return { error: "This deposit is already settled." };

      const { data: project } = await supabase
        .from("artist_client_projects")
        .select("id,title,client_user_id")
        .eq("id", deposit.project_id)
        .maybeSingle();
      if (!project || project.client_user_id !== userId) {
        return { error: "Only the customer on this project can pay the deposit." };
      }

      const { data: userRes } = await supabase.auth.getUser();
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "sek",
              product_data: {
                name: `${deposit.kind === "final" ? "Tattoo payment" : "Booking deposit"} — ${project.title}`,
              },
              unit_amount: deposit.amount_ore,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(userRes.user?.email && { customer_email: userRes.user.email }),
        metadata: {
          kind: "project_deposit",
          userId,
          depositId: deposit.id,
          paymentKind: deposit.kind,
          projectId: deposit.project_id,
          amountOre: String(deposit.amount_ore),
        },
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("project_deposits")
        .update({ stripe_session_id: session.id, environment: data.environment })
        .eq("id", deposit.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
