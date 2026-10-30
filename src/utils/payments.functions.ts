import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId: options.userId },
        });
      }
      return c.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

/**
 * Create a Stripe checkout session for a one-time motif purchase.
 * Uses price_data so artists can set any price without pre-creating products.
 */
export const createMotifCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      motifId: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!/^[0-9a-f-]{36}$/.test(data.motifId)) throw new Error("Invalid motifId");
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { supabase, userId } = context;

      // Load motif from DB (RLS: published motifs visible to authenticated)
      const { data: motif, error } = await supabase
        .from("marketplace_motifs")
        .select("id, name, description, price_ore, image_path, published")
        .eq("id", data.motifId)
        .maybeSingle();
      if (error || !motif) return { error: "Motif could not be found" };
      if (!motif.published) return { error: "This motif is not for sale" };

      // Already owned?
      const { data: existing } = await supabase
        .from("motif_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("motif_id", motif.id)
        .maybeSingle();
      if (existing) return { error: "You already own this motif" };

      const { data: userRes } = await supabase.auth.getUser();
      const email = userRes.user?.email ?? undefined;

      const stripe = createStripeClient(data.environment);
      const customerId = await resolveOrCreateCustomer(stripe, {
        userId,
        email,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "sek",
              product_data: {
                name: motif.name,
                ...(motif.description && { description: motif.description }),
              },
              unit_amount: motif.price_ore,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: `InkSimulator motif: ${motif.name}` },
        metadata: {
          userId,
          motifId: motif.id,
          priceOre: String(motif.price_ore),
          kind: "motif_purchase",
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

