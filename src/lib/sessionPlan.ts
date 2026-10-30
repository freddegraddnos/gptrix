/** Pure helpers for the studio's "Plan sessions" step. No I/O. */

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}

export function sessionPlanSummary(count: number, minutesEach: number) {
  const total = count * minutesEach;
  return { total, text: `${count} × ${formatDuration(minutesEach)} = ${formatDuration(total)}` };
}

export type LinkRecord = { sentAt: string | null; count: number | null; minutes: number | null };

/** What sending now would mean, given what was last recorded as sent. */
export function bookingLinkState(record: LinkRecord, count: number, minutes: number) {
  if (!record.sentAt) return "never_sent" as const;
  if (record.count === count && record.minutes === minutes) return "already_sent_same" as const;
  return "sent_with_other_plan" as const;
}

/** A free time can hold a session only if it is at least as long. */
export function slotFits(slotMinutes: number | null | undefined, sessionMinutes: number) {
  return typeof slotMinutes === "number" && slotMinutes >= sessionMinutes;
}

/** A send attempt older than this is treated as abandoned (crash/timeout). */
export const SEND_LOCK_MS = 60_000;

export type SendInput = {
  hasCustomer: boolean;
  matchingSlots: number;
  allowWithoutTimes: boolean;
  linkState: ReturnType<typeof bookingLinkState>;
  sendingSince: string | null;
  now: number;
};

/** Whether the booking link may be sent now, and if not, why. Same rule on client and server. */
export function sendDecision(i: SendInput) {
  if (!i.hasCustomer) return { ok: false as const, reason: "no_customer" as const };
  if (i.linkState === "already_sent_same") return { ok: false as const, reason: "already_sent" as const };
  if (i.sendingSince && i.now - new Date(i.sendingSince).getTime() < SEND_LOCK_MS) return { ok: false as const, reason: "in_progress" as const };
  if (i.matchingSlots === 0 && !i.allowWithoutTimes) return { ok: false as const, reason: "no_times" as const };
  return { ok: true as const, reason: null };
}

/** Minutes for each session in order. A saved per-session plan wins; otherwise every session gets the shared length. */
export function planMinutes(count: number, minutesEach: number, plan?: number[] | null): number[] {
  if (plan && plan.length === count && plan.every((m) => Number.isFinite(m) && m > 0)) return [...plan];
  return Array.from({ length: Math.max(0, count) }, () => minutesEach);
}

/** Minutes of session number `index` (0-based). */
export function sessionMinutesAt(index: number, count: number, minutesEach: number, plan?: number[] | null) {
  return planMinutes(count, minutesEach, plan)[index] ?? minutesEach;
}

/** True when sessions have different lengths. */
export function isMixedPlan(plan: number[]) {
  return new Set(plan).size > 1;
}

/** Plan text, e.g. "3 h + 2 h = 5 h". */
export function planSummary(plan: number[]) {
  const total = plan.reduce((a, b) => a + b, 0);
  if (!isMixedPlan(plan)) return sessionPlanSummary(plan.length, plan[0] ?? 0);
  return { total, text: `${plan.map(formatDuration).join(" + ")} = ${formatDuration(total)}` };
}

/**
 * Sessions that no published free time can hold. Each session needs its own
 * free time of at least its length; longest sessions pick first.
 */
export function unfitSessions(plan: number[], slotMinutes: (number | null | undefined)[]) {
  const free = slotMinutes.filter((m): m is number => typeof m === "number").sort((a, b) => a - b);
  const order = plan.map((m, i) => ({ m, i })).sort((a, b) => b.m - a.m);
  const missing: number[] = [];
  for (const { m, i } of order) {
    const idx = free.findIndex((f) => f >= m);
    if (idx === -1) missing.push(i);
    else free.splice(idx, 1);
  }
  return missing.sort((a, b) => a - b);
}

/** Stable key for "same plan already sent". */
export function planKey(plan: number[]) {
  return plan.join("-");
}
