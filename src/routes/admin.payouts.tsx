import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { listStudioBalances, recordPayout, type StudioBalance } from "@/lib/payouts.functions";
import { useAuth } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({
    meta: [
      { title: "Studio payouts — InkSimulator admin" },
      { name: "description", content: "What each studio is owed after InkSimulator's commission." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Studio payouts — InkSimulator admin" },
      { property: "og:description", content: "Studio balances after commission and payout history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayoutsPage,
});

const kr = (ore: number) => `${(ore / 100).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} kr`;

function PayoutsPage() {
  const hydrated = useHydrated();
  const { session, loading: authLoading } = useAuth();
  const fetchList = useServerFn(listStudioBalances);
  const { data, isLoading, error } = useQuery({
    queryKey: ["studio-balances"],
    queryFn: () => fetchList(),
    enabled: hydrated && !authLoading && Boolean(session?.access_token),
    retry: false,
  });

  return (
    <AppShell>
      <TopBar title="Payouts" />
      <main className="space-y-4 pb-24">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight">Studio payouts</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Customers pay InkSimulator. Each studio’s balance reflects recorded payments, fees and previous payouts. Pay them by bank transfer, then record it here.
          </p>
        </header>
        {hydrated && !authLoading && !session && (
          <div className="flex gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0" /> Sign in to view studio payouts.
          </div>
        )}
        {error && (
          <div className="flex gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" /> You need an admin account to view payouts.
          </div>
        )}
        {hydrated && session && isLoading && <Loader2 className="mx-auto size-5 animate-spin text-accent" />}
        {hydrated && data?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No paid payments yet.</p>
        )}
        <ul className="space-y-3">
          {(data ?? []).map((b) => (
            <BalanceCard key={b.studioId} b={b} />
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

function BalanceCard({ b }: { b: StudioBalance }) {
  const record = useServerFn(recordPayout);
  const qc = useQueryClient();
  const [amount, setAmount] = useState((Math.max(b.owedOre, 0) / 100).toString());
  const m = useMutation({
    mutationFn: () =>
      record({ data: { studioId: b.studioId, amountOre: Math.round(Number(amount) * 100) } }),
    onSuccess: () => {
      toast.success("Payout recorded");
      void qc.invalidateQueries({ queryKey: ["studio-balances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record payout"),
  });

  return (
    <li className="rounded-2xl border border-white/10 bg-slate p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-bold">{b.studioName}</div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">To pay</div>
          <div className="font-display text-xl font-bold text-accent">{kr(b.owedOre)}</div>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <dt>Tattoo payments</dt><dd className="text-right">{kr(b.tattooOre)}</dd>
        <dt>Design sales</dt><dd className="text-right">{kr(b.motifOre)}</dd>
        <dt>Recorded InkSimulator fees</dt><dd className="text-right">−{kr(b.feeOre)}</dd>
        <dt>Already paid out</dt><dd className="text-right">−{kr(b.paidOutOre)}</dd>
      </dl>
      {b.owedOre > 0 && (
        <div className="mt-3 flex gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-ink px-3 text-sm"
          />
          <Button
            disabled={m.isPending || !(Number(amount) > 0)}
            onClick={() => m.mutate()}
          >
            Mark as paid out
          </Button>
        </div>
      )}
    </li>
  );
}
