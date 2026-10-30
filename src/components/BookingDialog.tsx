import { IdentityPending } from "@/components/IdentityPending";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/track";
import { X, Calendar, Clock, Ruler, MapPin, Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { createBooking } from "@/hooks/useBookings";
import { uploadPreview } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { parseQuestions, type IntakeQuestion } from "@/lib/bookingIntake";
import { usePublicSlots } from "@/hooks/useStudio";
import { notifySlotBooking } from "@/lib/bookings.functions";
import { generateTattooPDF } from "@/lib/pdf";
import { useNavigate } from "@tanstack/react-router";
import { getActiveIdea } from "@/lib/ideaContext";
import { measurePlacement, type AutoPlacement } from "@/lib/autoPlacement";
import { loadCalibration } from "@/lib/scanCalibrationStore";
import { useStudioAccount } from "@/hooks/useStudioAccount";
import { StudioAccountNotice } from "@/components/StudioAccountNotice";

import { tx, useUiLang } from "@/lib/uiLang";
export type BookingStudio = {
  /** InkSimulator artist user id, when booking an InkSimulator-connected studio. */
  artistId?: string | null;
  name: string;
  address?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

const BODY_AREAS = [
  "Forearm",
  "Upper arm",
  "Shoulder",
  "Chest",
  "Back",
  "Leg",
  "Calf",
  "Hand",
  "Neck",
  "Other",
];

const TIME_SLOTS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function localDayIso(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function BookingDialog({
  studio,
  onClose,
}: {
  studio: BookingStudio | null;
  onClose: () => void;
}) {
  useUiLang();
  const { user } = useAuth();
  const studioAcct = useStudioAccount();
  const navigate = useNavigate();
  const { projects } = useProjects(user?.id);
  const {
    slots,
    loading: slotsLoading,
    claim,
  } = usePublicSlots(studio?.artistId ?? undefined, true);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("14:00");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  // Preselect the idea the customer is finding a studio for.
  useEffect(() => {
    const active = getActiveIdea();
    if (active && projects.some((p) => p.id === active)) setProjectId((cur) => cur || active);
  }, [projects]);
  const [bodyArea, setBodyArea] = useState(BODY_AREAS[0]);
  const [sizeCm, setSizeCm] = useState<string>("");
  const [note, setNote] = useState("");
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ownPhoto, setOwnPhoto] = useState<File | null>(null);
  const [calibPrompt, setCalibPrompt] = useState(false);
  const [ownPhotoUrl, setOwnPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!ownPhoto) return setOwnPhotoUrl(null);
    const u = URL.createObjectURL(ownPhoto);
    setOwnPhotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [ownPhoto]);
  const [adultChecked, setAdultChecked] = useState(false);

  // Pre-tick the box when the customer already confirmed 18+ in their profile.
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("adult_declared_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.adult_declared_at) setAdultChecked(true);
      });
  }, [user]);

  useEffect(() => {
    setQuestions([]);
    setGreeting(null);
    setAnswers({});
    const id = studio?.artistId;
    if (!id) return;
    void supabase.rpc("studio_booking_form", { _studio: id }).then(({ data }) => {
      const form = (data ?? {}) as { greeting?: string | null; questions?: unknown };
      setGreeting(form.greeting ?? null);
      setQuestions(parseQuestions(form.questions));
    });
  }, [studio?.artistId]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );
  const measureSrc =
    ownPhotoUrl ?? selectedProject?.preview_url ?? selectedProject?.base_photo_url ?? null;

  /** Open slots from the studio calendar, grouped per local day. */
  const days = useMemo(() => {
    const open = slots.filter((s) => s.status === "open");
    const map = new Map<string, typeof open>();
    for (const s of open) {
      const key = localDayIso(s.starts_at);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, list]) => ({
        day,
        list: [...list].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      }));
  }, [slots]);

  const hasCalendar = days.length > 0;

  useEffect(() => {
    if (!hasCalendar) return;
    const first = days[0];
    if (!first) return;
    setDate((d) => (days.some((x) => x.day === d) ? d : first.day));
  }, [hasCalendar, days]);

  const timesForDay = useMemo(() => days.find((d) => d.day === date)?.list ?? [], [days, date]);

  useEffect(() => {
    if (!hasCalendar) return;
    setSlotId((cur) =>
      timesForDay.some((s) => s.id === cur) ? cur : (timesForDay[0]?.id ?? null),
    );
  }, [hasCalendar, timesForDay]);

  useEffect(() => {
    if (!studio) {
      setDone(false);
      setError(null);
    } else {
      track("booking_started");
    }
  }, [studio]);

  useEffect(() => {
    if (selectedProject) {
      if (selectedProject.body_part) setBodyArea(selectedProject.body_part);
      if (selectedProject.width_cm) setSizeCm(String(selectedProject.width_cm));
    }
  }, [selectedProject]);

  if (!studio) return null;

  const chosenSlot = timesForDay.find((s) => s.id === slotId) ?? null;
  const chosenTime = chosenSlot ? hhmm(chosenSlot.starts_at) : time;

  const submit = async (estimateOk = false) => {
    let placement: AutoPlacement | null = null;
    if (!user) {
      onClose();
      navigate({ to: "/auth" });
      return;
    }
    if (hasCalendar && !chosenSlot) {
      setError(tx("Pick a time from the studio calendar."));
      return;
    }
    const missing = questions.find((q) => q.required && !answers[q.id]?.trim());
    if (missing) {
      setError(tx("Please answer: {q}", { q: missing.text }));
      return;
    }
    if (!adultChecked) {
      setError(tx("Confirm that you are 18 or older to send the request."));
      return;
    }
    if (!sizeCm || Number(sizeCm) <= 0) {
      setError(tx("Enter the motif size in centimeters."));
      return;
    }
    if (!ownPhoto && !selectedProject?.base_photo_url) {
      setError(tx("Add a customer photo before sending the request."));
      return;
    }
    const calibrated = !!(loadCalibration(user.id) ?? loadCalibration());
    if (!calibrated && !estimateOk) {
      setCalibPrompt(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Persist the declaration so the database check passes and future
      // bookings arrive pre-ticked.
      await supabase
        .from("profiles")
        .update({ adult_declared_at: new Date().toISOString() } as never)
        .eq("id", user.id)
        .is("adult_declared_at", null);
      const { data: adult } = await supabase.rpc("booking_adult_declared", { _user: user.id });
      if (!adult) throw new Error(tx("You must be 18 or older to send a booking."));
      // Automatic measurement: no extra steps for the customer.
      if (measureSrc) {
        placement = await measurePlacement(
          measureSrc,
          bodyArea,
          Number(sizeCm),
          calibrated,
          ownPhotoUrl ? null : selectedProject?.base_photo_url,
        ).catch(
          () => null,
        );
      }
      let basePhotoUrl: string | null = selectedProject?.base_photo_url ?? null;
      if (placement) {
        basePhotoUrl = (await uploadPreview(user.id, placement.annotated)).signedUrl;
      } else if (ownPhoto) {
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = rej;
          r.readAsDataURL(ownPhoto);
        });
        basePhotoUrl = (await uploadPreview(user.id, dataUrl)).signedUrl;
      }
      // A real calendar slot goes straight into the studio's calendar as a
      // pending request; free-text dates stay a plain request.
      if (chosenSlot) {
        await claim(chosenSlot.id, user.id);
      }
      await createBooking({
        userId: user.id,
        artistId: studio.artistId ?? null,
        studioName: studio.name,
        studioAddress: studio.address ?? null,
        studioPlaceId: studio.placeId ?? null,
        studioLat: studio.lat ?? null,
        studioLng: studio.lng ?? null,
        projectId: projectId || null,
        preferredDate: chosenSlot ? localDayIso(chosenSlot.starts_at) : date,
        preferredTime: chosenTime,
        durationMinutes: chosenSlot?.duration_minutes ?? 60,
        bodyArea,
        sizeCm: sizeCm ? Number(sizeCm) : null,
        note: [placement ? `Placement: ${placement.summary}` : null, note || null].filter(Boolean).join("\n\n") || null,
        slotId: chosenSlot?.id ?? null,
        basePhotoUrl,
        intakeAnswers: questions.length
          ? questions.map((q) => ({ question: q.text, answer: answers[q.id]?.trim() ?? "" }))
          : null,
      });
      if (chosenSlot) {
        void notifySlotBooking({
          data: { slotId: chosenSlot.id, action: "requested" },
        }).catch(() => undefined);
      }
      track("booking_completed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const downloadBrief = () => {
    generateTattooPDF({
      title: selectedProject?.name ?? "Tattoo brief",
      motifName: selectedProject?.tattoo_name ?? "Not selected",
      widthCm: sizeCm ? Number(sizeCm) : (selectedProject?.width_cm ?? undefined),
      bodyPart: bodyArea,
      previewUrl: selectedProject?.preview_url ?? undefined,
      studio: `${studio.name}${studio.address ? ` — ${studio.address}` : ""}`,
      note: `Preferred time: ${date} at ${time}\n${note}`.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-slate border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-slate/95 backdrop-blur px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-accent">
              {tx("Book appointment")}
            </div>
            <div className="font-bold truncate">{studio.name}</div>
            {studio.address && (
              <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="size-3" /> {studio.address}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-full bg-white/5 grid place-items-center hover:bg-white/10"
            aria-label={tx("Close")}
          >
            <X className="size-4" />
          </button>
        </div>

        {studioAcct.loading ? (
          <IdentityPending />
        ) : studioAcct.isStudio ? (
          <div className="p-5">
            <StudioAccountNotice studioName={studioAcct.studioName} onClose={onClose} />
          </div>
        ) : done ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto size-14 rounded-full bg-emerald-500/15 grid place-items-center">
              <Check className="size-6 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-lg">{tx("Request sent — awaiting approval")}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {date} kl {chosenTime} · {studio.name}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tx("Nothing is booked yet: your appointment is confirmed once the studio accepts the request. We'll email and notify you as soon as they answer. Bring the brief so the artist has everything: design, size, and placement.")}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={downloadBrief}
                className="h-11 rounded-xl border border-white/15 font-bold text-xs uppercase tracking-widest"
              >
                {tx("Download brief")}
              </button>
              <button
                onClick={() => {
                  onClose();
                  navigate({ to: "/bookings" });
                }}
                className="h-11 rounded-xl bg-accent text-ink font-bold text-xs uppercase tracking-widest"
              >
                {tx("My bookings")}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {hasCalendar ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1.5">
                    <Calendar className="size-3" />{" "}{tx("Pick a day")}
                  </div>
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                    {days.map(({ day, list }) => {
                      const d = new Date(`${day}T12:00:00`);
                      const active = day === date;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setDate(day)}
                          className={`shrink-0 w-16 py-2 rounded-2xl border text-center ${
                            active
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-white/10 bg-ink text-muted-foreground"
                          }`}
                        >
                          <div className="text-[10px] uppercase tracking-widest">
                            {d.toLocaleDateString([], { weekday: "short" })}
                          </div>
                          <div className="text-lg font-bold leading-tight text-foreground">
                            {d.getDate()}
                          </div>
                          <div className="text-[9px]">{list.length} free</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1.5">
                    <Clock className="size-3" />{" "}{tx("Pick a time")}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {timesForDay.map((s) => {
                      const active = s.id === slotId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSlotId(s.id)}
                          className={`h-11 rounded-xl border text-sm font-semibold ${
                            active
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-white/10 bg-ink"
                          }`}
                        >
                          {hhmm(s.starts_at)}
                        </button>
                      );
                    })}
                  </div>
                  {chosenSlot?.requires_3d && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {tx("This time requires a 3D scan before the session.")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1.5">
                    <Calendar className="size-3" />{" "}{tx("Date")}
                  </span>
                  <input
                    type="date"
                    min={todayIso()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1.5">
                    <Clock className="size-3" />{" "}{tx("Time")}
                  </span>
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm"
                  >
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {studio.artistId && !hasCalendar && !slotsLoading && (
              <p className="text-[11px] text-muted-foreground -mt-1">
                {tx("This studio hasn't published open times yet — send a request and they'll propose a time.")}
              </p>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                {tx("Design from portfolio")}
              </div>
              {projects.length === 0 ? (
                <div className="text-xs text-muted-foreground rounded-xl bg-ink border border-dashed border-white/10 p-3">
                  {tx("No saved placements yet. Just fill in the other fields, or save a project in AR first.")}
                </div>
              ) : (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm"
                >
                  <option value="">{tx("— None selected —")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.tattoo_name ? ` · ${p.tattoo_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  {tx("Body part")}
                </span>
                <select
                  value={bodyArea}
                  onChange={(e) => setBodyArea(e.target.value)}
                  className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm"
                >
                  {BODY_AREAS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-1.5">
                  <Ruler className="size-3" />{" "}{tx("Size (cm)")}
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  max={80}
                  value={sizeCm}
                  onChange={(e) => setSizeCm(e.target.value)}
                  className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                {tx("Message to the studio")}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={tx("Style, color vs black, references, budget…")}
                className="w-full rounded-xl bg-ink border border-white/10 px-3 py-2 text-sm resize-none"
              />
            </label>

            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">
                {tx("Your photo")}
              </span>
              <input
                type="file"
                accept="image/*"
                required={!selectedProject?.base_photo_url}
                onChange={(e) => setOwnPhoto(e.target.files?.[0] ?? null)}
                className="w-full text-xs"
              />
            </label>

            {calibPrompt && (
              <div className="space-y-2 rounded-xl border border-accent/40 bg-accent/10 p-3">
                <p className="text-xs leading-relaxed">
                  {tx("Measurements can't be guaranteed because the camera wasn't calibrated. Do you want to calibrate and retake, or send as an estimate?")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate({ to: "/calibrate" });
                    }}
                    className="h-10 rounded-xl border border-white/10 text-xs font-bold"
                  >
                    {tx("Calibrate & retake")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalibPrompt(false);
                      void submit(true);
                    }}
                    className="h-10 rounded-xl bg-accent text-ink text-xs font-bold"
                  >
                    {tx("Send as an estimate")}
                  </button>
                </div>
              </div>
            )}

            {(greeting || questions.length > 0) && (
              <div className="space-y-3 rounded-xl border border-white/10 p-3">
                {greeting && <p className="text-sm">{greeting}</p>}
                {questions.map((q) => (
                  <label key={q.id} className="block">
                    <span className="text-xs font-semibold mb-1.5 block">
                      {q.text}
                      {q.required && <span className="text-accent"> *</span>}
                    </span>
                    {q.type === "yesno" ? (
                      <div className="grid grid-cols-2 gap-2">
                        {["Yes", "No"].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                            className={`h-10 rounded-xl border text-sm ${answers[q.id] === v ? "border-accent bg-accent/15 text-accent" : "border-white/10 bg-ink"}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        maxLength={500}
                        className="w-full h-11 rounded-xl bg-ink border border-white/10 px-3 text-sm"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={adultChecked}
                onChange={(e) => setAdultChecked(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[color:var(--accent)]"
              />
              <span className="text-xs leading-relaxed">
                {tx("I confirm that I am")}{" "}<strong>{tx("18 years or older")}</strong>{" "}{tx("and may legally get a tattoo.")}
              </span>
            </label>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                {error}
              </div>
            )}

            <button
              onClick={() => void submit()}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-accent text-ink font-bold text-sm uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {tx("Send request")}
            </button>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              {tx("This is a request, not a confirmed booking — the studio has to accept it first. You'll be notified by email and in the app as soon as they answer.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
