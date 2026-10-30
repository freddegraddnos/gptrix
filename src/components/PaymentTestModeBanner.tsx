const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as
  | string
  | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-500/15 border-b border-red-500/30 px-4 py-2 text-center text-xs text-red-200">
        Live payments are not configured. Complete the Stripe go-live process to accept real purchases.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-accent/15 border-b border-accent/30 px-4 py-2 text-center text-[11px] text-accent uppercase tracking-widest font-bold">
        Test mode · Use card number 4242 4242 4242 4242
      </div>
    );
  }
  return null;
}
