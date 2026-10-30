import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createMotifCheckout } from "@/utils/payments.functions";

export function MotifCheckout({
  motifId,
  returnUrl,
}: {
  motifId: string;
  returnUrl: string;
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createMotifCheckout({
      data: { motifId, returnUrl, environment: getStripeEnvironment() },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("No client_secret from Stripe");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="min-h-[500px]">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
