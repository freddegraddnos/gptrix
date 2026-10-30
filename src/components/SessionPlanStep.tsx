import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BellRing, CalendarPlus, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArtistRequest } from "@/hooks/useArtistRequests";
import { getSessionPlanContext } from "@/lib/projectSessions.functions";
import { bookingLinkState, formatDuration, planKey, planMinutes, planSummary, sendDecision } from "@/lib/sessionPlan";
import { tx } from "@/lib/uiLang";

type Booked = { id: string; status: string; session_number: number };
type Ctx = Awaited<ReturnType<typeof getSessionPlanContext>>;

/** Design (sketch) domain — never mixed with booking confirmation. */
const DESIGN_LABEL: Record<string, string> = {
  open: "Open",
  sketch_in_progress: "Sketch in progress",
  changes_requested: "Changes requested",
  approved: "Design approved",
  booked: "Booked",
  completed: "Completed",
  archived: "Archived",
};

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-all">{value}</dd>
    </div>
  );
}

/** The studio's "Plan sessions" step: plan, check, then decide to send. */
export function SessionPlanStep(props: {
  project: ArtistRequest;
  booked: Booked[];
  count: string;
  minutes: string;
  setCount: (v: string) => void;
  setMinutes: (v: string) => void;
  mixed: boolean;
  setMixed: (v: boolean) => void;
  lengths: string[];
  setLengths: (v: string[]) => void;
  busy: boolean;
  sendingLink: boolean;
  onSave: () => Promise<void> | void;
  onSend: (allowWithoutTimes: boolean) => void;
  onNotifyTimesAdded: () => void;
}) {
  const { project, booked, count, minutes } = props;
  const load = useServerFn(getSessionPlanContext);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [allowWithout, setAllowWithout] = useState(false);
  useEffect(() => {
    void load({ data: { projectId: project.id } }).then(setCtx).catch(() => setCtx(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.session_minutes, project.latest_activity_at]);

  const n = Number(count);
  const m = Number(minutes);
  const okMin = (x: number) => Number.isInteger(x) && x >= 30 && x <= 720;
  const countOk = Number.isInteger(n) && n >= 1 && n <= 20;
  const draftPlan = countOk ? (props.mixed ? Array.from({ length: n }, (_, i) => Number(props.lengths[i] ?? m)) : planMinutes(n, m)) : [];
  const valid = countOk && draftPlan.every(okMin) && (props.mixed || okMin(m));
  const plan = valid ? planSummary(draftPlan) : null;
  const savedPlan = planMinutes(project.session_count, project.session_minutes, project.session_plan);
  const sentPlan = planMinutes(project.booking_link_session_count ?? 0, project.booking_link_session_minutes ?? 0, project.booking_link_session_plan);
  const rawLinkState = bookingLinkState(
    { sentAt: project.booking_link_sent_at ?? null, count: project.booking_link_session_count ?? null, minutes: project.booking_link_session_minutes ?? null },
    n,
    props.mixed ? Math.max(...draftPlan, 0) : m,
  );
  const linkState = rawLinkState === "already_sent_same" && planKey(sentPlan) !== planKey(draftPlan) ? "sent_with_other_plan" as const : rawLinkState;
  const awaiting = booked.filter((b) => b.status === "awaiting_deposit").length;
  const changedFromSaved = planKey(draftPlan) !== planKey(savedPlan);
  // Context counts fitting times for the saved length; an unsaved length is not checked yet.
  const unfit = ctx && !changedFromSaved ? ctx.unfitSessions : null;
  const matching = ctx && !changedFromSaved ? (unfit && unfit.length > 0 ? 0 : ctx.openSlotsMatching) : null;
  const noTimes = matching === 0;
  const decision = ctx && matching !== null
    ? sendDecision({ hasCustomer: ctx.hasCustomer, matchingSlots: matching, allowWithoutTimes: allowWithout, linkState, sendingSince: null, now: Date.now() })
    : null;

  const paymentValue = !ctx
    ? "…"
    : ctx.deposit
      ? ctx.deposit.status === "paid" ? tx("Deposit paid") : tx("Deposit requested, not paid")
      : tx("No deposit requested");

  const depositEffect = !ctx
    ? "…"
    : !ctx.requireDeposit
      ? tx("Booked times are confirmed directly.")
      : ctx.deposit?.status === "paid"
        ? tx("Deposit paid — booked times are confirmed directly.")
        : tx("Booked times are held until the deposit is paid.");

  const ageValue = !ctx
    ? "…"
    : !ctx.age
      ? tx("Not requested")
      : ctx.age.status === "approved"
        ? tx("Verified")
        : tx("Requested — booking blocked until verified");

  const recipient = !ctx
    ? "…"
    : !ctx.hasCustomer
      ? tx("No customer account — link cannot be sent")
      : [project.client_name, ctx.recipientEmail ?? project.client_email].filter(Boolean).join(" · ") || tx("Linked customer account (no name or e-mail shown)");

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">{tx("Step")} · {tx("Plan sessions")}</p>
        <h3 className="mt-1 font-display text-lg uppercase">{tx("Plan sessions")}</h3>
      </div>

      {project.more_times_requested_at && (
        <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">
          <p className="font-semibold">{tx("Customer needs more booking times")} · {formatDuration(savedPlan[booked.length] ?? project.session_minutes)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to="/artists/dashboard" search={{ tab: "kalender" }}><CalendarPlus className="size-4" />{tx("Add free times")}</Link></Button>
            <Button type="button" size="sm" variant="outline" disabled={props.busy || noTimes || matching === null} onClick={props.onNotifyTimesAdded}><BellRing className="size-4" />{tx("Notify the customer")}</Button>
          </div>
          {noTimes && <p className="mt-2 text-xs text-muted-foreground">{tx("Add a free time that fits before notifying the customer.")}</p>}
        </div>
      )}
      {!project.more_times_requested_at && project.more_times_notified_at && (
        <p className="text-xs text-muted-foreground">{tx("Customer notified about new times")} {new Date(project.more_times_notified_at).toLocaleString()}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <StatusBox label={tx("Design")} value={`${tx(DESIGN_LABEL[project.status] ?? project.status)}${project.final_sketch_version_id ? ` · ${tx("final sketch approved")}` : ""}`} />
        <StatusBox label={tx("Booking")} value={`${booked.length} / ${project.session_count} ${tx("booked")}${awaiting ? ` · ${awaiting} ${tx("waiting for deposit")}` : ""}`} />
        <StatusBox label={tx("Payment")} value={paymentValue} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Number of sessions")}</span>
          <input type="number" min="1" max="20" value={count} onChange={(e) => props.setCount(e.target.value)} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm" />
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Minutes per session")}</span>
          <input type="number" min="30" max="720" step="15" value={minutes} disabled={props.mixed} onChange={(e) => props.setMinutes(e.target.value)} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm disabled:opacity-60" />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={props.mixed} onChange={(e) => {
          props.setMixed(e.target.checked);
          if (e.target.checked && countOk) props.setLengths(Array.from({ length: n }, (_, i) => props.lengths[i] ?? String(m)));
        }} />
        {tx("Different length per session")}
      </label>
      {props.mixed && countOk && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: n }, (_, i) => (
            <label key={i} className="min-w-0">
              <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Session")} {i + 1} · {tx("minutes")}</span>
              <input type="number" min="30" max="720" step="15" value={props.lengths[i] ?? minutes} onChange={(e) => { const next = Array.from({ length: n }, (_, j) => props.lengths[j] ?? minutes); next[i] = e.target.value; props.setLengths(next); }} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm" />
            </label>
          ))}
        </div>
      )}
      <p className="text-base font-semibold" aria-live="polite">
        {plan ? <>{plan.text} <span className="text-sm font-normal text-muted-foreground">{tx("planned in total")}</span></> : tx("Enter 1–20 sessions of 30–720 minutes.")}
      </p>
      <p className="text-xs text-muted-foreground">{props.mixed ? tx("Sessions are booked in this order. Each session needs its own free time that is long enough.") : tx("All sessions have the same length.")}</p>
      <Button type="button" variant="outline" className="w-full" disabled={props.busy || !valid || !changedFromSaved} onClick={() => void props.onSave()}>
        <Save className="size-4" />{changedFromSaved ? tx("Save plan") : tx("Plan saved")}
      </Button>

      {changedFromSaved && booked.length > 0 && (
        <p className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
          {tx("Already booked sessions keep their time and length. Changes only apply to sessions that are not booked yet.")}
          {valid && n < booked.length ? ` ${tx("Lowering the number does not cancel booked sessions.")}` : ""}
        </p>
      )}

      <dl className="divide-y divide-border border-y border-border">
        <Row label={tx("Recipient")} value={recipient} />
        <Row label={tx("Artist")} value={ctx?.artistName ?? tx("Unassigned — the studio's shared calendar is used")} />
        <Row label={tx("Sessions")} value={plan?.text ?? "–"} />
        <Row label={tx("Deposit rule")} value={depositEffect} />
        <Row label={tx("Age verification")} value={ageValue} />
        <Row label={tx("Free times that fit")} value={matching === null ? (changedFromSaved ? tx("Save the plan to check") : "…") : `${matching} ${tx("of")} ${ctx?.openSlots ?? 0}`} />
      </dl>

      {noTimes && (
        <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-3">
          <p className="text-sm font-semibold">{unfit && unfit.length > 0 && new Set(savedPlan).size > 1
            ? <>{tx("There are no published free times that fit")} {unfit.map((i) => `${tx("session")} ${i} (${formatDuration(savedPlan[i - 1] ?? 0)})`).join(", ")}.</>
            : <>{tx("There are no published free times that fit a session of")} {formatDuration(Math.max(...savedPlan))}.</>}</p>
          <Button asChild className="w-full"><Link to="/artists/dashboard" search={{ tab: "kalender" }}><CalendarPlus className="size-4" />{tx("Add free times")}</Link></Button>
          <p className="text-xs text-muted-foreground">{tx("The plan is saved and stays here when you come back.")}</p>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5 size-4" checked={allowWithout} onChange={(e) => setAllowWithout(e.target.checked)} />
            <span>{tx("Send anyway without free times. The customer opens the link, sees that no time can be booked yet and can ask the studio for more times.")}</span>
          </label>
        </div>
      )}

      <div className="rounded-md border border-border p-3 text-xs">
        {linkState === "never_sent" && <p>{tx("No booking link has been recorded as sent for this request.")}</p>}
        {linkState !== "never_sent" && project.booking_link_sent_at && (
          <p>
            {tx("Booking link recorded as sent")} {new Date(project.booking_link_sent_at).toLocaleString()} ·{" "}
            {planSummary(sentPlan).text}
          </p>
        )}
        {linkState === "already_sent_same" && <p className="mt-1 text-muted-foreground">{tx("The customer already has the link for this plan. It will not be sent twice.")}</p>}
        {linkState === "sent_with_other_plan" && <p className="mt-1 text-muted-foreground">{tx("The plan has changed. Sending gives the customer one updated notice with the new plan.")}</p>}
      </div>

      {(!noTimes || allowWithout) && (
        <Button type="button" className="w-full" disabled={props.sendingLink || changedFromSaved || !decision?.ok} onClick={() => props.onSend(allowWithout)}>
          <Send className="size-4" />
          {props.sendingLink ? tx("Sending…") : linkState === "sent_with_other_plan" ? tx("Send updated booking link") : tx("Send booking link")}
        </Button>
      )}
      {changedFromSaved && <p className="text-xs text-muted-foreground">{tx("Save the plan before sending the booking link.")}</p>}
    </section>
  );
}
