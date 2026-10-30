/**
 * Orders for the designs this studio sells in the gallery.
 */
import { useEffect, useState } from "react";
import { FileCheck2, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { exportToFortnox } from "@/lib/fortnox.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatKr } from "@/hooks/useMarketplace";

import { tx, useUiLang } from "@/lib/uiLang";
type Sale = {
  id: string;
  created_at: string;
  price_paid_ore: number;
  motif_name: string;
  buyer: string;
  fortnox: string | null;
};

export function MotifSales({ studioId }: { studioId: string }) {
  useUiLang();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const send = async (id: string) => {
    setSendingId(id);
    try {
      const res = await exportToFortnox({ data: { kind: "motif", id } });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(tx("Sent to Fortnox — invoice {n}", { n: res.invoiceNumber }));
        setSales((all) => all.map((s) => (s.id === id ? { ...s, fortnox: res.invoiceNumber } : s)));
      }
    } finally {
      setSendingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: motifs } = await supabase
        .from("marketplace_motifs")
        .select("id, name")
        .eq("artist_id", studioId);
      const ids = (motifs ?? []).map((m) => m.id);
      if (!ids.length) {
        if (!cancelled) {
          setSales([]);
          setLoading(false);
        }
        return;
      }
      const nameById = new Map((motifs ?? []).map((m) => [m.id, m.name]));
      const { data: rows } = await supabase
        .from("motif_purchases")
        .select("id, created_at, price_paid_ore, motif_id, user_id, fortnox_invoice_number")
        .in("motif_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);

      const buyerIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", buyerIds.length ? buyerIds : ["00000000-0000-0000-0000-000000000000"]);
      const buyerById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

      if (cancelled) return;
      setSales(
        (rows ?? []).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          price_paid_ore: r.price_paid_ore ?? 0,
          motif_name: nameById.get(r.motif_id) ?? "Design",
          buyer: buyerById.get(r.user_id) ?? "Client",
          fortnox: r.fortnox_invoice_number ?? null,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studioId]);

  const now = new Date();
  const thisMonth = sales.filter((s) => {
    const d = new Date(s.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = thisMonth.reduce((sum, s) => sum + s.price_paid_ore, 0);

  if (loading) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate p-4">
        <div className="text-mono-caps text-[10px] text-accent">{tx("This month")}</div>
        <div className="mt-1 font-display text-2xl font-bold">{formatKr(monthTotal)}</div>
        <div className="text-xs text-muted-foreground">
          {thisMonth.length} {thisMonth.length === 1 ? "sale" : "sales"} · {sales.length}{" "}{tx("in total")}
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-6 text-center">
          <ShoppingBag className="mx-auto size-6 text-accent" />
          <p className="mt-2 text-sm font-bold">{tx("No sales yet")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx("Designs you publish in the gallery show up here as soon as a client buys one.")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sales.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{s.motif_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.buyer} · {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-accent">{formatKr(s.price_paid_ore)}</div>
                {s.fortnox ? (
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                    <FileCheck2 className="size-3" />{" "}{tx("Fortnox")}{" "}{s.fortnox}
                  </div>
                ) : (
                  <button
                    onClick={() => void send(s.id)}
                    disabled={sendingId === s.id}
                    className="mt-1 text-[10px] font-bold uppercase tracking-widest text-accent disabled:opacity-50"
                  >
                    {sendingId === s.id ? tx("Sending…") : tx("Send to Fortnox")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
