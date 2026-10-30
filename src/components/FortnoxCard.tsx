import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenCheck, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  disconnectFortnox,
  getFortnoxStatus,
  startFortnoxConnect,
  updateFortnoxSettings,
} from "@/lib/fortnox.functions";
import { getMyStudioBalance } from "@/lib/payouts.functions";

import { tx, useUiLang } from "@/lib/uiLang";
type Status = Awaited<ReturnType<typeof getFortnoxStatus>>;

/** Accounting: connect the studio's own Fortnox and pick accounts. */
export function FortnoxCard({ studioId, showSetup = true }: { studioId: string; showSetup?: boolean }) {
  useUiLang();
  const fetchStatus = useServerFn(getFortnoxStatus);
  const connect = useServerFn(startFortnoxConnect);
  const disconnect = useServerFn(disconnectFortnox);
  const save = useServerFn(updateFortnoxSettings);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState(false);
  const fetchBalance = useServerFn(getMyStudioBalance);
  const [balance, setBalance] = useState<Awaited<ReturnType<typeof getMyStudioBalance>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ sales: "3001", vat: "25", payment: "1580", fee: "6570" });

  const load = useCallback(async () => {
    try {
      const s = await fetchStatus({ data: { studioId } });
      setStatus(s);
      setStatusError(false);
      setForm({
        sales: String(s.salesAccount),
        vat: String(s.vatPercent),
        payment: String(s.paymentAccount),
        fee: String(s.feeAccount),
      });
    } catch {
      setStatus(null);
      setStatusError(true);
    }
  }, [fetchStatus, studioId]);

  useEffect(() => {
    void load();
    fetchBalance({ data: { studioId } }).then(setBalance).catch(() => setBalance(null));
    const q = new URLSearchParams(window.location.search).get("fortnox");
    if (q === "connected") toast.success(tx("Fortnox is connected"));
    else if (q) toast.error(tx("Fortnox could not be connected. Try again."));
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string) => (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {key === "vat" ? (
        <select
          value={form.vat}
          onChange={(e) => setForm({ ...form, vat: e.target.value })}
          className="h-10 w-full rounded-lg border border-white/10 bg-ink px-2 text-sm"
        >
          {["25", "12", "6", "0"].map((v) => (
            <option key={v} value={v}>
              {v} %
            </option>
          ))}
        </select>
      ) : (
        <input
          inputMode="numeric"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          className="h-10 w-full rounded-lg border border-white/10 bg-ink px-3 text-sm"
        />
      )}
    </label>
  );

  const kr = (ore: number) => `${Math.round(ore / 100).toLocaleString("sv-SE")} kr`;

  return (
    <>
    {balance && (
      <div className="mb-4 rounded-2xl border border-white/10 bg-slate p-4">
        <div className="text-mono-caps text-[10px] text-accent">{tx("Payout from InkSimulator")}</div>
        <div className="mt-1 font-display text-2xl font-bold">{kr(balance.owedOre)}</div>
        <p className="text-xs text-muted-foreground">
          {kr(balance.tattooOre + balance.motifOre)}{" "}{tx("paid by customers −")}{" "}{kr(balance.feeOre)}{" "}{tx("Recorded InkSimulator fees −")}{" "}{kr(balance.paidOutOre)}{" "}{tx("already paid out.")}
        </p>
      </div>
    )}
    {(showSetup || status?.connected || statusError) && <div className="mb-4 rounded-2xl border border-white/10 bg-slate p-4">
      <div className="flex items-center gap-2 text-mono-caps text-[10px] text-accent">
        <BookOpenCheck className="size-3" />{" "}{tx("Accounting · Fortnox")}
      </div>
      {statusError ? (
        <p role="alert" className="mt-2 text-xs text-muted-foreground">{tx("Could not load Fortnox status. Please try again.")}</p>
      ) : !status ? (
        <Loader2 className="mt-3 size-4 animate-spin text-accent" />
      ) : !status.configured ? (
        <p className="mt-2 text-xs text-muted-foreground">{tx("Fortnox will be available here soon.")}</p>
      ) : !status.connected ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {tx("Connect your Fortnox to send paid deposits, tattoo payments and design sales to your books with one tap. Any recorded InkSimulator fees are shown as costs.")}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const { url } = await connect({ data: { studioId } });
                window.location.href = url;
              })
            }
            className="mt-3 h-10 rounded-xl bg-accent px-4 text-sm font-bold text-ink disabled:opacity-50"
          >
            {tx("Connect Fortnox")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs">
            {tx("Connected")}{status.companyName ? ` to ${status.companyName}` : ""}.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {field("sales", "Sales account")}
            {field("vat", "VAT")}
            {field("payment", "Card payment account")}
            {field("fee", "InkSimulator fee account")}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    save({
                      data: {
                        studioId,
                        salesAccount: Number(form.sales),
                        vatPercent: Number(form.vat) as 0 | 6 | 12 | 25,
                        paymentAccount: Number(form.payment),
                        feeAccount: Number(form.fee),
                      },
                    }),
                  "Settings saved",
                )
              }
              className="h-10 rounded-xl border border-accent/60 px-4 text-sm font-bold text-accent disabled:opacity-50"
            >
              {tx("Save")}
            </button>
            <button
              disabled={busy}
              onClick={() => void run(() => disconnect({ data: { studioId } }), "Fortnox disconnected")}
              className="flex h-10 items-center gap-1 rounded-xl border border-white/10 px-3 text-xs text-muted-foreground"
            >
              <Unplug className="size-3.5" />{" "}{tx("Disconnect")}
            </button>
          </div>
        </>
      )}
    </div>}
    </>
  );
}
