import { useState } from "react";
import { CreditCard, FileCheck2, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  cancelProjectDeposit,
  createDepositCheckout,
  setProjectDeposit,
} from "@/lib/deposits.functions";
import { exportToFortnox } from "@/lib/fortnox.functions";
import type { ProjectDeposit } from "@/hooks/useArtistRequests";

import { tx, useUiLang } from "@/lib/uiLang";
/**
 * Booking deposit: the studio sets an amount, the customer pays it by card.
 * Both sides see Not paid / Paid here.
 */
export function DepositSection({
  projectId,
  deposit,
  artistMode,
  onRefresh,
  kind = "deposit",
}: {
  kind?: "deposit" | "final";
  projectId: string;
  deposit: ProjectDeposit | null;
  artistMode: boolean;
  onRefresh: () => Promise<void>;
}) {
  useUiLang();
  const [amount, setAmount] = useState(deposit ? String(deposit.amount_ore / 100) : "");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  const paid = deposit?.status === "paid";
  const isFinal = kind === "final";
  const [sending, setSending] = useState(false);

  const sendToFortnox = async () => {
    if (!deposit) return;
    setSending(true);
    try {
      const res = await exportToFortnox({ data: { kind: "deposit", id: deposit.id } });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(tx("Sent to Fortnox — invoice {n}", { n: res.invoiceNumber }));
        await onRefresh();
      }
    } finally {
      setSending(false);
    }
  };

  const save = async () => {
    const kronor = Number(amount);
    if (!Number.isFinite(kronor) || kronor < 50) {
      toast.error(tx("Enter an amount of at least 50 kr."));
      return;
    }
    setBusy(true);
    try {
      await setProjectDeposit({ data: { projectId, amountOre: Math.round(kronor * 100), kind } });
      toast.success(isFinal ? "Payment request sent to the customer" : "Deposit request sent to the customer");
      await onRefresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save the deposit");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!deposit) return;
    setBusy(true);
    try {
      await cancelProjectDeposit({ data: { depositId: deposit.id } });
      toast.success(tx("Request cancelled"));
      setAmount("");
      await onRefresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not cancel the deposit");
    } finally {
      setBusy(false);
    }
  };

  const fetchClientSecret = async (): Promise<string> => {
    if (!deposit) throw new Error(tx("No deposit to pay"));
    const result = await createDepositCheckout({
      data: {
        depositId: deposit.id,
        returnUrl: `${window.location.origin}/requests/${projectId}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error(tx("No client_secret from Stripe"));
    return result.clientSecret;
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">{isFinal ? tx("Tattoo payment") : tx("Booking deposit")}</p>
          <p className="mt-1 text-2xl font-display font-bold">
            {deposit ? `${(deposit.amount_ore / 100).toLocaleString()} kr` : tx("Not requested")}
          </p>
          {deposit?.paid_at && (
            <p className="text-xs text-muted-foreground">
              {tx("Paid")}{" "}{new Date(deposit.paid_at).toLocaleString()}
            </p>
          )}
        </div>
        {deposit && (
          <span
            className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase ${
              paid ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
            }`}
          >
            {paid ? tx("Paid") : tx("Not paid")}
          </span>
        )}
      </div>

      {artistMode && paid && deposit && (
        deposit.fortnox_invoice_number ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCheck2 className="size-4 text-accent" />{" "}{tx("Sent to Fortnox — invoice")}{" "}{deposit.fortnox_invoice_number}
          </p>
        ) : (
          <Button type="button" variant="outline" disabled={sending} onClick={() => void sendToFortnox()}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
            {tx("Send to Fortnox")}
          </Button>
        )
      )}

      {artistMode && isFinal && !paid && (
        <p className="text-xs text-muted-foreground">
          {tx("Enter what is left to pay for the tattoo (total price minus the deposit).")}
        </p>
      )}

      {artistMode && !paid && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
              {tx("Amount (SEK)")}
            </span>
            <input
              type="number"
              min="50"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-secondary px-3"
            />
          </label>
          <Button type="button" className="sm:mt-6" disabled={busy} onClick={() => void save()}>
            <Save className="size-4" />
            {deposit ? tx("Update amount") : tx("Send payment link")}
          </Button>
          {deposit && (
            <Button
              type="button"
              variant="ghost"
              className="sm:mt-6"
              disabled={busy}
              onClick={() => void cancel()}
            >
              <X className="size-4" />
              {tx("Cancel")}
            </Button>
          )}
        </div>
      )}

      {!artistMode && deposit && !paid && (
        <>
          <p className="text-sm text-muted-foreground">
            {isFinal
              ? tx("Pay for your tattoo. Card payment, handled securely.")
              : tx("Pay the deposit to secure your booking. Card payment, handled securely.")}
          </p>
          {paying ? (
            <div id={`${kind}-checkout`} className="min-h-[500px]">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <Button type="button" size="lg" onClick={() => setPaying(true)}>
              <CreditCard className="size-4" />
              {tx("Pay")}{" "}{(deposit.amount_ore / 100).toLocaleString()} kr{isFinal ? "" : " deposit"}
            </Button>
          )}
        </>
      )}

      {!artistMode && !deposit && !isFinal && (
        <p className="text-sm text-muted-foreground">
          {tx("The studio has not asked for a deposit on this project.")}
        </p>
      )}

      {busy && <Loader2 className="size-4 animate-spin text-accent" />}
    </section>
  );
}
