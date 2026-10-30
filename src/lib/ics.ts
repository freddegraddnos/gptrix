export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  /** Local start as ISO string or Date. */
  start: Date;
  durationMinutes: number;
  url?: string;
  /** IANA zone the appointment's wall-clock time belongs to. */
  timeZone?: string;
}

/** Studios in this app operate on Swedish wall-clock time. */
export const STUDIO_TZ = "Europe/Stockholm";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toUtcStamp(d: Date) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(event: CalendarEvent) {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InkSimulator//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${event.timeZone ?? STUDIO_TZ}`,
    "BEGIN:VEVENT",
    `UID:${event.id}@inksimulator.com`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(event.start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : null,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    event.url ? `URL:${event.url}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tattoo appointment tomorrow",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function downloadIcs(event: CalendarEvent) {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inksimulator-${event.id.slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function googleCalendarUrl(event: CalendarEvent) {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(event.start)}/${toUtcStamp(end)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Offset (in minutes) of a time zone at a given instant, DST included.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"] === "24" ? "0" : parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  return (asUtc - instant.getTime()) / 60000;
}

/**
 * Turns a wall-clock date + time in a specific zone into the correct absolute
 * instant. Handles DST and stays right no matter where the viewer is.
 */
export function zonedDateTime(date: string, time?: string | null, timeZone = STUDIO_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "12:00").split(":").map(Number);
  const naiveUtc = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 12, mm ?? 0, 0, 0);
  // Two passes so the DST boundary resolves to the correct offset.
  let guess = new Date(naiveUtc - zoneOffsetMinutes(new Date(naiveUtc), timeZone) * 60000);
  guess = new Date(naiveUtc - zoneOffsetMinutes(guess, timeZone) * 60000);
  return guess;
}

/**
 * Combines a YYYY-MM-DD date with an optional HH:MM time, anchored to the
 * studio's time zone (not the device's), so travelling never shifts a booking.
 */
export function localDateTime(date: string, time?: string | null, timeZone = STUDIO_TZ) {
  return zonedDateTime(date, time, timeZone);
}

/** Human-readable appointment time rendered in the studio's zone. */
export function formatInZone(instant: Date, timeZone = STUDIO_TZ) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}

/**
 * "Add to calendar" link for Outlook on the web. Outlook.com (personal) and
 * Office 365 (work) use the same shape on different hosts.
 */
export function outlookCalendarUrl(event: CalendarEvent, flavour: "live" | "office" = "live") {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60000);
  const host = flavour === "office" ? "outlook.office.com" : "outlook.live.com";
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: end.toISOString(),
  });
  if (event.description) params.set("body", event.description);
  if (event.location) params.set("location", event.location);
  return `https://${host}/calendar/0/deeplink/compose?${params.toString()}`;
}
