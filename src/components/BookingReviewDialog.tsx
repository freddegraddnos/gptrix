import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mail, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Booking } from "@/hooks/useBookings";
import {
  approveBooking,
  approveBookingWithTimes,
  declineBooking,
  getBookingReview,
} from "@/lib/bookingReview.functions";
import { t, useStudioLang } from "@/lib/studioLang";
import { useStudioTheme } from "@/lib/studioTheme";

import { tx, useUiLang } from "@/lib/uiLang";
const c = {
  title: { en: "Booking request", sv: "Bokningsförfrågan" },
  customer: { en: "Customer", sv: "Kund" },
  images: { en: "Images", sv: "Bilder" },
  noImages: { en: "No images attached.", sv: "Inga bilder bifogade." },
  approve: { en: "Approve", sv: "Godkänn" },
  decline: { en: "Decline", sv: "Avvisa" },
  sessions: { en: "Number of sessions", sv: "Antal sittningar" },
  hours: { en: "Hours per session", sv: "Timmar per sittning" },
  sendLink: { en: "Approve & send booking link", sv: "Godkänn och skicka bokningslänk" },
  sendTimes: { en: "Approve & send time suggestions", sv: "Godkänn och skicka tidsförslag" },
  suggestions: { en: "Suggested times", sv: "Föreslagna tider" },
  message: { en: "Message to the customer", sv: "Meddelande till kunden" },
  reason: { en: "Explanation to the customer", sv: "Förklaring till kunden" },
  sendDecline: { en: "Decline & send", sv: "Avvisa och skicka" },
  back: { en: "Back", sv: "Tillbaka" },
  withT: { en: "With tattoo", sv: "Med tatuering" },
  withoutT: { en: "Without tattoo", sv: "Utan tatuering" },
  own: { en: "Customer photo", sv: "Kundens bild" },
  answers: { en: "Answers", sv: "Svar" },
  approved: {
    en: "Approved — the customer got a calendar link.",
    sv: "Godkänd — kunden har fått en kalenderlänk.",
  },
  declined: {
    en: "Declined — the customer was emailed.",
    sv: "Avvisad — kunden har fått ett mail.",
  },
};

type Review = Awaited<ReturnType<typeof getBookingReview>>;

export function BookingReviewDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking | null;
  onClose: () => void;
  onDone: () => void;
}) {
  useUiLang();
  const [lang] = useStudioLang();
  const [studioTheme] = useStudioTheme();
  const load = useServerFn(getBookingReview);
  const approve = useServerFn(approveBooking);
  const approveWithTimes = useServerFn(approveBookingWithTimes);
  const decline = useServerFn(declineBooking);
  const [review, setReview] = useState<Review | null>(null);
  const [mode, setMode] = useState<"view" | "approve" | "decline">("view");
  const [sessions, setSessions] = useState(1);
  const [hours, setHours] = useState(3);
  const [comment, setComment] = useState("");
  const [approvalKind, setApprovalKind] = useState<"link" | "times">("link");
  const [suggestions, setSuggestions] = useState([""]);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    setReview(null);
    setMode("view");
    setComment("");
    if (!booking) return;
    void load({ data: { bookingId: booking.id } })
      .then(setReview)
      .catch(() =>
        setReview({
          customer: { name: "—", email: null, phone: null, avatar: null },
          images: [],
          answers: [],
        }),
      );
  }, [booking, load]);

  const submit = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      if (mode === "approve") {
        if (approvalKind === "times") {
          const values = suggestions.filter(Boolean).map((value) => new Date(value).toISOString());
          await approveWithTimes({
            data: {
              bookingId: booking.id,
              sessions,
              minutesPerSession: Math.round(hours * 60),
              suggestions: values,
              note: comment,
            },
          });
        } else {
          await approve({
            data: { bookingId: booking.id, sessions, minutesPerSession: Math.round(hours * 60) },
          });
        }
        toast.success(t(c.approved, lang));
      } else {
        await decline({ data: { bookingId: booking.id, comment } });
        toast.success(t(c.declined, lang));
      }
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `h-10 min-w-10 rounded-md border px-3 text-sm font-bold ${active ? "border-accent bg-accent text-accent-foreground" : "border-border"}`;

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`${studioTheme === "bright" ? "studio-bright" : ""} max-h-[92dvh] overflow-y-auto text-foreground sm:max-w-lg`}
      >
        <DialogHeader>
          <DialogTitle>{t(c.title, lang)}</DialogTitle>
        </DialogHeader>
        {booking && (
          <div className="space-y-4 text-sm">
            <section>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t(c.customer, lang)}
              </p>
              {!review ? (
                <Loader2 className="mt-2 size-4 animate-spin text-accent" />
              ) : (
                <div className="mt-1 space-y-1">
                  <p className="text-base font-bold">{review.customer.name}</p>
                  {review.customer.email && (
                    <a
                      href={`mailto:${review.customer.email}`}
                      className="flex items-center gap-2 text-accent"
                    >
                      <Mail className="size-3.5" />
                      {review.customer.email}
                    </a>
                  )}
                  {review.customer.phone && (
                    <a
                      href={`tel:${review.customer.phone}`}
                      className="flex items-center gap-2 text-accent"
                    >
                      <Phone className="size-3.5" />
                      {review.customer.phone}
                    </a>
                  )}
                </div>
              )}
            </section>
            <section className="grid grid-cols-2 gap-2 text-xs">
              <p>
                <span className="text-muted-foreground">{tx("Datum:")}{" "}</span>
                {booking.preferred_date}
                {booking.preferred_time ? ` ${booking.preferred_time}` : ""}
              </p>
              {booking.body_area && (
                <p>
                  <span className="text-muted-foreground">{tx("Placering:")}{" "}</span>
                  {booking.body_area}
                </p>
              )}
              {booking.size_cm != null && (
                <p>
                  <span className="text-muted-foreground">{tx("Storlek:")}{" "}</span>
                  {booking.size_cm} cm
                </p>
              )}
              {booking.duration_minutes != null && (
                <p>
                  <span className="text-muted-foreground">{tx("Tid:")}{" "}</span>
                  {booking.duration_minutes} min
                </p>
              )}
            </section>
            {review && review.answers.length > 0 && (
              <section>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(c.answers, lang)}
                </p>
                <dl className="mt-1 space-y-1.5">
                  {review.answers.map((a, i) => (
                    <div key={i}>
                      <dt className="text-xs text-muted-foreground">{a.question}</dt>
                      <dd className="font-semibold">{a.answer || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {booking.note && (
              <p className="whitespace-pre-wrap rounded-md border border-border p-3">
                {booking.note}
              </p>
            )}
            <section>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t(c.images, lang)}
              </p>
              {review && review.images.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{t(c.noImages, lang)}</p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {review?.images.map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setZoom(img.url)}
                    className="overflow-hidden rounded-md border border-border bg-paper"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="aspect-square w-full object-contain"
                    />
                    {img.label && (
                      <span className="block border-t border-border py-1 text-[10px] font-bold uppercase tracking-widest">
                        {t(
                          img.label === "with"
                            ? c.withT
                            : img.label === "without"
                              ? c.withoutT
                              : c.own,
                          lang,
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {mode === "view" && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setMode("decline")}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-bold uppercase tracking-widest"
                >
                  <X className="size-4" />
                  {t(c.decline, lang)}
                </button>
                <button
                  onClick={() => setMode("approve")}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-md bg-accent text-xs font-bold uppercase tracking-widest text-accent-foreground"
                >
                  <Check className="size-4" />
                  {t(c.approve, lang)}
                </button>
              </div>
            )}

            {mode === "approve" && (
              <div className="space-y-3 rounded-md border border-accent p-3">
                <p className="text-xs font-bold">{t(c.sessions, lang)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} className={chip(sessions === n)} onClick={() => setSessions(n)}>
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={sessions}
                    onChange={(e) =>
                      setSessions(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                    }
                    className="h-10 w-16 rounded-md border border-border bg-background px-2"
                  />
                </div>
                <p className="text-xs font-bold">{t(c.hours, lang)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                    <button key={n} className={chip(hours === n)} onClick={() => setHours(n)}>
                      {n}h
                    </button>
                  ))}
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    max={12}
                    value={hours}
                    onChange={(e) =>
                      setHours(Math.max(0.5, Math.min(12, Number(e.target.value) || 1)))
                    }
                    className="h-10 w-16 rounded-md border border-border bg-background px-2"
                  />
                </div>
                <p className="text-center font-display text-2xl">
                  {sessions} × {hours}h
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApprovalKind("link")}
                    className={chip(approvalKind === "link")}
                  >
                    {tx("Booking link")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalKind("times")}
                    className={chip(approvalKind === "times")}
                  >
                    {tx("Time suggestions")}
                  </button>
                </div>
                {approvalKind === "times" && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold">{t(c.suggestions, lang)}</p>
                    {suggestions.map((value, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="datetime-local"
                          required
                          value={value}
                          onChange={(event) =>
                            setSuggestions((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? event.target.value : item,
                              ),
                            )
                          }
                          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                        />
                        {suggestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSuggestions((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                            className="h-10 rounded-md border border-border px-3"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {suggestions.length < 4 && (
                      <button
                        type="button"
                        onClick={() => setSuggestions((current) => [...current, ""])}
                        className="text-xs font-bold text-accent"
                      >
                        {tx("+ Add another time")}
                      </button>
                    )}
                    <p className="text-xs font-bold">{t(c.message, lang)}</p>
                    <textarea
                      required
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      rows={3}
                      maxLength={1000}
                      className="w-full rounded-md border border-border bg-background p-2"
                    />
                  </div>
                )}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <button
                    onClick={() => setMode("view")}
                    className="h-11 rounded-md border border-border px-3 text-xs"
                  >
                    {t(c.back, lang)}
                  </button>
                  <button
                    disabled={
                      busy ||
                      (approvalKind === "times" &&
                        (!comment.trim() || suggestions.every((value) => !value)))
                    }
                    onClick={() => void submit()}
                    className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-60"
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {t(approvalKind === "times" ? c.sendTimes : c.sendLink, lang)}
                  </button>
                </div>
              </div>
            )}

            {mode === "decline" && (
              <div className="space-y-3 rounded-md border border-destructive p-3">
                <p className="text-xs font-bold">{t(c.reason, lang)}</p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  className="w-full rounded-md border border-border bg-background p-2"
                />
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <button
                    onClick={() => setMode("view")}
                    className="h-11 rounded-md border border-border px-3 text-xs"
                  >
                    {t(c.back, lang)}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void submit()}
                    className="flex h-11 items-center justify-center gap-2 rounded-md bg-destructive text-xs font-bold uppercase tracking-widest text-destructive-foreground disabled:opacity-60"
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {t(c.sendDecline, lang)}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {zoom && (
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="fixed inset-0 z-[100] grid place-items-center bg-background/95 p-4"
          >
            <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
