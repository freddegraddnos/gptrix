import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ChevronLeft, ChevronRight, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePublicSlots } from "@/hooks/useStudio";
import type { ArtistRequest } from "@/hooks/useArtistRequests";
import {
  bookProjectSession,
  notifyCustomerTimesAdded,
  proposeProjectTime,
  refreshProjectAvailability,
  requestMoreTimes,
  respondTimeProposal,
  sendSessionBookingLink,
  setProjectSessions,
} from "@/lib/projectSessions.functions";
import { formatDuration, planMinutes, planSummary, sessionMinutesAt, slotFits } from "@/lib/sessionPlan";
import { SessionPlanStep } from "@/components/SessionPlanStep";

import { tx, useUiLang } from "@/lib/uiLang";
type BookedSession = {
  id: string;
  status: string;
  preferred_date: string;
  preferred_time: string | null;
  session_number: number;
};

type TimeProposal = {
  id: string;
  proposed_date: string;
  time_window: "morning" | "afternoon" | "evening";
  note: string | null;
  status: "open" | "accepted" | "declined";
  created_at: string;
};

const WINDOW_LABEL: Record<TimeProposal["time_window"], string> = {
  morning: "Morning (9–12)",
  afternoon: "Afternoon (12–17)",
  evening: "Evening (17–20)",
};
/** Default exact start per window when the studio accepts a proposal. */
const WINDOW_START_HOUR: Record<TimeProposal["time_window"], number> = {
  morning: 10,
  afternoon: 13,
  evening: 17,
};

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Monday-first grid of the given month, padded with the surrounding days. */
const monthGrid = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: dayKey(d), date: d, inMonth: d.getMonth() === month };
  });
};

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const nextDays = (n: number) => {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
};

export function ProjectSessionPicker({
  project,
  artistMode,
  sessions,
  onRefresh,
}: {
  project: ArtistRequest;
  artistMode: boolean;
  sessions: BookedSession[];
  onRefresh: () => void | Promise<void>;
}) {
  useUiLang();
  const { slots, loading, refresh: refreshSlots } = usePublicSlots(project.artist_id, true);
  const book = useServerFn(bookProjectSession);
  const saveSessions = useServerFn(setProjectSessions);
  const propose = useServerFn(proposeProjectTime);
  const sendLink = useServerFn(sendSessionBookingLink);
  const refreshAvailability = useServerFn(refreshProjectAvailability);
  const respond = useServerFn(respondTimeProposal);
  const askMore = useServerFn(requestMoreTimes);
  const notifyAdded = useServerFn(notifyCustomerTimesAdded);
  const [showMore, setShowMore] = useState(false);
  const [moreSent, setMoreSent] = useState(false);
  const [moreMsg, setMoreMsg] = useState(() => tx("Hi! I'm trying to book my session but can't find any free times. Could you add more?"));
  const [count, setCount] = useState(String(project.session_count));
  const [minutes, setMinutes] = useState(String(project.session_minutes));
  const [mixed, setMixed] = useState(Boolean(project.session_plan?.length));
  const [lengths, setLengths] = useState<string[]>(() => planMinutes(project.session_count, project.session_minutes, project.session_plan).map(String));
  // Length of the next session the customer books (sessions follow the plan order).
  const nextMinutes = sessionMinutesAt(sessions.filter((s) => s.status !== "cancelled").length, project.session_count, project.session_minutes, project.session_plan);
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [sendingLink, setSendingLink] = useState(false);
  const [busy, setBusy] = useState(false);

  const [proposals, setProposals] = useState<TimeProposal[]>([]);
  const [showPropose, setShowPropose] = useState(false);
  const [propDate, setPropDate] = useState("");
  const [propWindow, setPropWindow] = useState<TimeProposal["time_window"]>("afternoon");
  const [propNote, setPropNote] = useState("");
  const [acceptTime, setAcceptTime] = useState<Record<string, string>>({});

  const loadProposals = useCallback(async () => {
    const { data } = await supabase
      .from("project_time_proposals")
      .select("id, proposed_date, time_window, note, status, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setProposals((data ?? []) as TimeProposal[]);
  }, [project.id]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  // Pull the studio's busy times once when the calendar opens.
  useEffect(() => {
    if (artistMode) return;
    let cancelled = false;
    void refreshAvailability({ data: { projectId: project.id } })
      .then(() => {
        if (!cancelled) void refreshSlots();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, artistMode]);

  /** Day-level availability derived from open slots only — never busy details. */
  const availability = useMemo(() => {
    const freeDays = new Set<string>();
    const byDay = new Map<string, typeof slots>();
    // Only times long enough for one planned session are offered.
    for (const slot of slots.filter((s) => slotFits(s.duration_minutes, nextMinutes))) {
      const starts = new Date(slot.starts_at);
      const key = `${starts.getFullYear()}-${String(starts.getMonth() + 1).padStart(2, "0")}-${String(starts.getDate()).padStart(2, "0")}`;
      freeDays.add(key);
      byDay.set(key, [...(byDay.get(key) ?? []), slot]);
    }
    return { freeDays, byDay };
  }, [slots, nextMinutes]);

  const booked = sessions.filter((s) => s.status !== "cancelled");
  const remaining = Math.max(0, project.session_count - booked.length);
  const canPick = !artistMode && ["approved", "booked"].includes(project.status) && remaining > 0;
  const openProposals = proposals.filter((p) => p.status === "open");

  const onSaveSessions = async () => {
    setBusy(true);
    try {
      await saveSessions({
        data: {
          projectId: project.id,
          sessionCount: Number(count),
          sessionMinutes: mixed ? Math.max(...lengths.slice(0, Number(count)).map(Number)) : Number(minutes),
          sessionPlan: mixed ? lengths.slice(0, Number(count)).map(Number) : null,
        },
      });
      toast.success(tx("Plan saved. Nothing was sent to the customer."));
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the sessions.");
    } finally {
      setBusy(false);
    }
  };

  const onSendLink = async (allowWithoutTimes: boolean) => {
    if (sendingLink) return;
    setSendingLink(true);
    try {
      const result = await sendLink({ data: { projectId: project.id, allowWithoutTimes } });
      if (result.alreadySent) toast.message(tx("The customer already has the link for this plan. Nothing was sent again."));
      else toast.success(tx("Booking link recorded as sent."));
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the booking link.");
    } finally {
      setSendingLink(false);
    }
  };

  const onNotifyTimesAdded = async () => {
    setBusy(true);
    try {
      const r = await notifyAdded({ data: { projectId: project.id } });
      toast.success(r.alreadyNotified ? tx("The customer was already notified.") : tx("The customer has been notified about new times."));
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not notify the customer.");
    } finally {
      setBusy(false);
    }
  };

  const onAskMoreTimes = async () => {
    setBusy(true);
    try {
      await askMore({ data: { projectId: project.id, message: moreMsg.trim() } });
      setMoreSent(true);
      setShowMore(false);
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  const onBook = async (slotId: string) => {
    setBusy(true);
    try {
      const result = await book({ data: { projectId: project.id, slotId } });
      toast.success(
        result.awaitingDeposit
          ? "Time held — pay the deposit to confirm it."
          : `Session ${result.sessionNumber} booked.`,
      );
      await refreshSlots();
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not book that time.");
    } finally {
      setBusy(false);
    }
  };

  const onPropose = async () => {
    if (!propDate) {
      toast.error(tx("Pick a date first."));
      return;
    }
    setBusy(true);
    try {
      await propose({
        data: {
          projectId: project.id,
          date: propDate,
          timeWindow: propWindow,
          note: propNote.trim() || undefined,
        },
      });
      toast.success(tx("Proposal sent to the studio."));
      setShowPropose(false);
      setPropNote("");
      await loadProposals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the proposal.");
    } finally {
      setBusy(false);
    }
  };

  const onRespond = async (proposal: TimeProposal, accept: boolean) => {
    setBusy(true);
    try {
      let startsAt: string | undefined;
      if (accept) {
        const custom = acceptTime[proposal.id];
        const fallbackHour = WINDOW_START_HOUR[proposal.time_window];
        const base = custom
          ? new Date(custom)
          : new Date(`${proposal.proposed_date}T${String(fallbackHour).padStart(2, "0")}:00:00`);
        if (Number.isNaN(base.getTime())) throw new Error(tx("Pick the exact start time."));
        startsAt = base.toISOString();
      }
      const result = await respond({ data: { proposalId: proposal.id, accept, startsAt } });
      toast.success(
        !result.accepted
          ? "Proposal declined — the customer has been notified."
          : result.awaitingDeposit
            ? "Time booked — waiting for the deposit."
            : `Session ${result.sessionNumber} booked.`,
      );
      await loadProposals();
      await refreshSlots();
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not answer the proposal.");
    } finally {
      setBusy(false);
    }
  };

  const selectedDay = day && availability.freeDays.has(day) ? day : undefined;

  return (
    <div className="space-y-5">
      {artistMode ? (
        <SessionPlanStep
          project={project}
          booked={booked}
          count={count}
          minutes={minutes}
          setCount={setCount}
          setMinutes={setMinutes}
          busy={busy}
          sendingLink={sendingLink}
          mixed={mixed}
          setMixed={setMixed}
          lengths={lengths}
          setLengths={setLengths}
          onSave={() => void onSaveSessions()}
          onSend={(allow) => void onSendLink(allow)}
          onNotifyTimesAdded={() => void onNotifyTimesAdded()}
        />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">{tx("Sessions")}</p>
          <p className="mt-1 text-sm">
            {booked.length} {tx("of")} {project.session_count} {tx("booked")} · {planSummary(planMinutes(project.session_count, project.session_minutes, project.session_plan)).text}
          </p>
        </div>
      )}

      {booked.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {booked
            .slice()
            .sort((a, b) => a.session_number - b.session_number)
            .map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  {tx("Session")}{" "}{s.session_number} · {s.preferred_date}
                  {s.preferred_time ? ` at ${s.preferred_time}` : ""}
                </span>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {s.status === "awaiting_deposit" ? tx("Waiting for deposit") : s.status === "confirmed" ? tx("Time confirmed") : s.status === "pending" ? tx("Awaiting studio") : s.status === "declined" ? tx("Declined") : s.status}
                </span>
              </li>
            ))}
        </ul>
      )}

      {proposals.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-accent">
            {tx("Proposed times")}
          </p>
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {p.proposed_date} · {WINDOW_LABEL[p.time_window]}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      p.status === "open"
                        ? "text-amber-400"
                        : p.status === "accepted"
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                {p.note && <p className="mt-1 text-xs text-muted-foreground">“{p.note}”</p>}
                {artistMode && p.status === "open" && (
                  <div className="mt-3 space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                        {tx("Exact start (to accept)")}
                      </span>
                      <input
                        type="datetime-local"
                        value={acceptTime[p.id] ?? `${p.proposed_date}T${String(WINDOW_START_HOUR[p.time_window]).padStart(2, "0")}:00`}
                        onChange={(e) =>
                          setAcceptTime((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={busy} onClick={() => void onRespond(p, true)}>
                        {tx("Accept & book")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void onRespond(p, false)}
                      >
                        {tx("Decline")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canPick ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-accent">
            {tx("Pick your time ·")}{" "}{remaining}{" "}{tx("left to book")}
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">{tx("Loading free times…")}</p>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    aria-label={tx("Previous month")}
                    className="grid size-9 place-items-center rounded-lg border border-white/10"
                    onClick={() =>
                      setMonth((m) =>
                        m.month === 0
                          ? { year: m.year - 1, month: 11 }
                          : { year: m.year, month: m.month - 1 },
                      )
                    }
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-sm font-semibold">
                    {new Date(month.year, month.month, 1).toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    aria-label={tx("Next month")}
                    className="grid size-9 place-items-center rounded-lg border border-white/10"
                    onClick={() =>
                      setMonth((m) =>
                        m.month === 11
                          ? { year: m.year + 1, month: 0 }
                          : { year: m.year, month: m.month + 1 },
                      )
                    }
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
                  {WEEK_LABELS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {monthGrid(month.year, month.month).map((cell) => {
                    const free = availability.freeDays.has(cell.key);
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={!free}
                        aria-label={`${cell.key} ${free ? "available" : "busy"}`}
                        onClick={() => setDay(cell.key)}
                        className={`h-11 rounded-lg border text-xs ${
                          selectedDay === cell.key
                            ? "border-accent bg-accent/15 text-accent"
                            : free
                              ? "border-emerald-400/40 bg-emerald-400/10"
                              : "border-white/5 text-muted-foreground/50"
                        } ${cell.inMonth ? "" : "opacity-40"}`}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {tx("Highlighted days are Available — everything else is Busy.")}
                </p>
              </div>
              {selectedDay && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(availability.byDay.get(selectedDay) ?? []).map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void onBook(slot.id)}
                      className="rounded-xl border border-white/10 py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      {timeLabel(slot.starts_at)}
                    </button>
                  ))}
                </div>
              )}
              {availability.freeDays.size === 0 && (
                <div className="mt-3 space-y-3 rounded-2xl border border-border bg-secondary/40 p-4">
                  <p className="text-sm font-semibold">
                    {tx("There are no free times right now for your session of")} {formatDuration(nextMinutes)}.
                  </p>
                  {moreSent || project.more_times_requested_at ? (
                    <p className="text-sm" role="status">
                      {moreSent ? tx("Your request has been sent to the studio. No time is booked yet.") : tx("Request already sent")}
                    </p>
                  ) : showMore ? (
                    <>
                      <textarea
                        aria-label={tx("Message to the studio")}
                        value={moreMsg}
                        maxLength={1000}
                        rows={4}
                        onChange={(e) => setMoreMsg(e.target.value)}
                        className="w-full rounded-md border border-border bg-secondary p-3 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">{tx("You can add days or times that suit you.")}</p>
                      <div className="flex gap-2">
                        <Button type="button" disabled={busy || !moreMsg.trim()} onClick={() => void onAskMoreTimes()}>{tx("Send")}</Button>
                        <Button type="button" variant="outline" disabled={busy} onClick={() => setShowMore(false)}>{tx("Cancel")}</Button>
                      </div>
                    </>
                  ) : (
                    <Button type="button" className="w-full" onClick={() => setShowMore(true)}>{tx("Ask the studio for more times")}</Button>
                  )}
                </div>
              )}
              <div className="mt-4">
                {showPropose ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
                      {tx("Propose a time")}
                    </p>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">{tx("Day")}</span>
                      <input
                        type="date"
                        value={propDate}
                        min={nextDays(1)[0]}
                        onChange={(e) => setPropDate(e.target.value)}
                        className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm"
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(WINDOW_LABEL) as TimeProposal["time_window"][]).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setPropWindow(w)}
                          className={`rounded-xl border px-2 py-2 text-[11px] font-semibold ${
                            propWindow === w ? "border-accent bg-accent/10 text-accent" : "border-white/10"
                          }`}
                        >
                          {WINDOW_LABEL[w]}
                        </button>
                      ))}
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">
                        {tx("Comment (optional)")}
                      </span>
                      <input
                        type="text"
                        value={propNote}
                        maxLength={280}
                        placeholder={tx("Anything the studio should know")}
                        onChange={(e) => setPropNote(e.target.value)}
                        className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={busy} onClick={() => void onPropose()}>
                        {tx("Send proposal")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setShowPropose(false)}
                      >
                        {tx("Cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || openProposals.length >= 3}
                    onClick={() => setShowPropose(true)}
                  >
                    <CalendarClock className="size-4" />
                    {availability.freeDays.size === 0
                      ? tx("Propose a time")
                      : tx("None of these work? Propose a time")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        !artistMode && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            {remaining === 0
              ? tx("All your sessions are booked.")
              : tx("You can pick a time once the studio approves the sketch.")}
          </p>
        )
      )}
    </div>
  );
}
