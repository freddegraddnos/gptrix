import { publicSiteUrl } from "@/lib/publicOrigin";
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const kind = session.metadata?.kind;
  const userId = session.metadata?.userId;
  if (!userId) return;

  if (kind === "motif_purchase") {
    const motifId = session.metadata?.motifId;
    if (!motifId) return;
    const priceOre = Number(session.metadata?.priceOre ?? session.amount_total ?? 0);
    await getSupabase()
      .from("motif_purchases")
      .upsert(
        {
          user_id: userId,
          motif_id: motifId,
          price_paid_ore: priceOre,
          stripe_session_id: session.id,
          environment: env,
        },
        { onConflict: "stripe_session_id" },
      );

    // Tell the artist they made a sale.
    try {
      const db = getSupabase();
      const { data: motif } = await db
        .from("marketplace_motifs")
        .select("id, name, artist_id")
        .eq("id", motifId)
        .maybeSingle();
      if (motif?.artist_id) {
        const { notifyUser } = await import("@/lib/notify.server");
        const amount = `${Math.round(priceOre / 100)} kr`;
        await notifyUser(motif.artist_id, {
          kind: "message",
          title: "You sold a design",
          body: `${motif.name} was just bought for ${amount}.`,
          url: "/artists/dashboard",
          inApp: { kind: "message" },
          email: {
            template: "new-message",
            templateData: {
              senderName: "InkSimulator",
              preview: `${motif.name} was just bought for ${amount}. Open your studio panel to see all sales.`,
              link: publicSiteUrl("/artists/dashboard"),
            },
            idempotencyKey: `motif-sale-${session.id}`,
          },
        });
      }
    } catch (err) {
      console.error("[webhook] sale notification failed", err);
    }
    return;
  }

  if (kind === "project_deposit") {
    const depositId = session.metadata?.depositId;
    const projectId = session.metadata?.projectId;
    if (!depositId || !projectId) return;
    const db = getSupabase();
    await db
      .from("project_deposits")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent ?? null,
        environment: env,
      })
      .eq("id", depositId)
      .neq("status", "paid");
    if (session.metadata?.paymentKind === "final") return;

    // When the studio requires a paid deposit, the held appointment now counts.
    const { data: project } = await db
      .from("artist_client_projects")
      .select("id, artist_id")
      .eq("id", projectId)
      .maybeSingle();
    if (project) {
      const { data: studio } = await db
        .from("artist_profiles")
        .select("require_deposit_for_confirmation")
        .eq("user_id", project.artist_id)
        .maybeSingle();
      if (studio?.require_deposit_for_confirmation) {
        await db
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("artist_project_id", projectId)
          .eq("status", "awaiting_deposit");
      }
    }
    return;
  }

  if (kind === "day_pass") {
    // One-time 24h access — store as a synthetic "subscription" row so gating works uniformly.
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await getSupabase().from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_subscription_id: `daypass_${session.id}`,
        stripe_customer_id: session.customer ?? "",
        product_id: "inkvision_day",
        price_id: "inkvision_day_once",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        environment: env,
        updated_at: now.toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
  }
}

async function handleSubscriptionCreated(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  const item = sub.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      product_id: productId,
      price_id: priceId,
      status: sub.status,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionUpdated(sub: any, env: StripeEnv) {
  const item = sub.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await getSupabase()
    .from("subscriptions")
    .update({
      status: sub.status,
      product_id: productId,
      price_id: priceId,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
}

async function handleSubscriptionDeleted(sub: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
