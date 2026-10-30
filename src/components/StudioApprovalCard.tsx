import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getStudioApproval,
  requestStudioApproval,
  type StudioApprovalState,
} from "@/lib/studioApproval.functions";
import { useStudioLang } from "@/lib/studioLang";

/**
 * New studios fill in their profile, then ask to join. They stay hidden from
 * search, the map and bookings until InkSimulator approves them.
 */
export function StudioApprovalCard() {
  const [lang] = useStudioLang();
  const tr = (en: string, sv: string) => lang === "sv" ? sv : en;
  const load = useServerFn(getStudioApproval);
  const ask = useServerFn(requestStudioApproval);
  const [state, setState] = useState<StudioApprovalState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load({ data: undefined }).then(setState).catch(() => setState(null));
  }, [load]);

  if (!state || state.status === "approved") return null;

  const send = async () => {
    setBusy(true);
    try {
      await ask({ data: undefined });
      setState({ status: "requested", requestedAt: new Date().toISOString() });
      toast.success("Request sent — we'll review your studio shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-slate p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        {state.status === "requested" ? (
          <Clock className="size-4 text-accent" />
        ) : (
          <CheckCircle2 className="size-4 text-accent" />
        )}
        {state.status === "requested"
          ? tr("Waiting for publication review", "Väntar på publiceringsgranskning")
          : state.status === "rejected"
            ? tr("Not approved for publication", "Inte godkänd för publicering")
            : tr("Request publication", "Begär publicering")}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {state.status === "requested"
          ? tr("Your studio is hidden from clients until InkSimulator approves it for publication. This is separate from the Verified badge.", "Studion är dold för kunder tills InkSimulator godkänner den för publicering. Detta är separat från märkningen Verifierad.")
          : tr("Complete the studio profile, then request publication. This controls public visibility and is separate from verification.", "Fyll i studioprofilen och begär sedan publicering. Detta styr offentlig synlighet och är separat från verifiering.")}
      </p>
      {state.status !== "requested" && (
        <button
          onClick={send}
          disabled={busy}
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[11px] font-bold uppercase tracking-widest text-ink disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {tr("Request publication", "Begär publicering")}
        </button>
      )}
    </section>
  );
}
