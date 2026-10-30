import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Calendar,
  Check,
  Clock,
  Globe,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Send,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getStudioDetails, type StudioDetails } from "@/lib/studios.functions";
import { listMyMotifs, subscribeMyMotifs, type MyMotif } from "@/lib/myMotifs";

import { tx, useUiLang } from "@/lib/uiLang";
export type StudioSheetTarget = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Only InkSimulator studios are ever shown. */
  source?: "partner";
};

async function motifFile(motif: MyMotif): Promise<File | null> {
  try {
    const res = await fetch(motif.src);
    const blob = await res.blob();
    return new File([blob], `inksimulator-${motif.id}.png`, {
      type: blob.type || "image/png",
    });
  } catch {
    return null;
  }
}

/**
 * Full studio profile for mobile: photos, price level, opening hours,
 * contact details and a one-tap way to send a design to the studio.
 */
export function StudioDetailSheet({
  target,
  onClose,
  onBook,
}: {
  target: StudioSheetTarget | null;
  onClose: () => void;
  onBook: (target: StudioSheetTarget) => void;
}) {
  useUiLang();
  const fetchDetails = useServerFn(getStudioDetails);
  const [details, setDetails] = useState<StudioDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [motifs, setMotifs] = useState<MyMotif[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setMotifs(listMyMotifs());
    return subscribeMyMotifs(() => setMotifs(listMyMotifs()));
  }, []);

  useEffect(() => {
    if (!target) return;
    let active = true;
    setDetails(null);
    setError(null);
    setHoursOpen(false);
    setSendOpen(false);
    setSent(false);
    setLoading(true);
    fetchDetails({ data: { placeId: target.placeId } })
      .then((d) => active && setDetails(d))
      .catch((e: unknown) =>
        active
          ? setError(
              e instanceof Error ? e.message : "Could not load the studio.",
            )
          : null,
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [target, fetchDetails]);

  const price = useMemo(() => {
    if (!details) return null;
    if (details.priceRange) return details.priceRange;
    if (details.priceLevel) return "€".repeat(details.priceLevel);
    return null;
  }, [details]);

  const send = useCallback(async () => {
    if (!target) return;
    const motif = motifs.find((m) => m.id === picked) ?? motifs[0];
    if (!motif) return;
    setSending(true);
    try {
      const text = `Hi ${target.name}! I designed this tattoo in InkSimulator — about ${motif.widthCm} cm wide. Could you quote it?`;
      const file = await motifFile(motif);
      if (
        file &&
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file] });
      } else if (details?.phone) {
        window.location.href = `sms:${details.phone.replace(/\s/g, "")}?&body=${encodeURIComponent(text)}`;
      } else if (details?.website) {
        window.open(details.website, "_blank", "noopener");
      } else {
        await navigator.clipboard.writeText(text);
        toast.success(tx("Message copied — paste it to the studio."));
      }
      setSent(true);
    } catch {
      toast.error(tx("Could not send the design. Try sharing it manually."));
    } finally {
      setSending(false);
    }
  }, [details, motifs, picked, target]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={tx("Close studio")}
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink/98 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/10 bg-ink/95 px-5 py-4 backdrop-blur-xl">
          {details?.logoUrl && (
            <img src={details.logoUrl} alt={`${target.name} logo`} className="size-11 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-black tracking-tight">
              {target.name}
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {details?.address || target.address}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full hover:bg-white/10"
            aria-label={tx("Close")}
          >
            <X className="size-4" />
          </button>
        </div>

        {loading && (
          <div className="grid h-32 place-items-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {error && (
          <p className="mx-5 mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[12px] text-destructive">
            {error}
          </p>
        )}

        {details && (
          <>
            {details.photos.length > 0 && (
              <div className="flex snap-x gap-2 overflow-x-auto px-5 py-4">
                {details.photos.map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt={`${details.name} studio`}
                    loading="lazy"
                    className="h-40 w-56 flex-none snap-start rounded-2xl object-cover ring-1 ring-white/10"
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 px-5">
              {details.rating != null && (
                <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-bold text-accent">
                  <Star className="size-3 fill-current" />
                  {details.rating.toFixed(1)}
                  {details.userRatingCount != null && (
                    <span className="text-muted-foreground">
                      ({details.userRatingCount})
                    </span>
                  )}
                </span>
              )}
              {price && (
                <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-bold">
                  <Wallet className="size-3 text-accent" />
                  {price}
                </span>
              )}
              {details.openNow != null && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    details.openNow
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  {details.openNow ? tx("Open now") : tx("Closed")}
                </span>
              )}
            </div>

            {details.hours.length > 0 && (
              <div className="mt-4 px-5">
                <button
                  type="button"
                  onClick={() => setHoursOpen((v) => !v)}
                  aria-expanded={hoursOpen}
                  className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
                >
                  <Clock className="size-4 text-accent" />
                  <span className="flex-1 text-[12px] font-bold">
                    {tx("Opening hours")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {hoursOpen ? tx("Hide") : tx("Show")}
                  </span>
                </button>
                {hoursOpen && (
                  <ul className="mt-2 space-y-1 rounded-2xl bg-white/[0.02] p-3 text-[12px] text-muted-foreground">
                    {details.hours.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 px-5">
              <a
                href={details.phone ? `tel:${details.phone.replace(/\s/g, "")}` : undefined}
                aria-disabled={!details.phone}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-widest ${
                  details.phone ? "" : "pointer-events-none opacity-40"
                }`}
              >
                <Phone className="size-3.5" />
                {tx("Call")}
              </a>
              <a
                href={details.website ?? (details.handle ? `/${details.handle}` : undefined)}
                target={details.website ? "_blank" : undefined}
                rel="noreferrer"
                aria-disabled={!details.website && !details.handle}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-widest ${
                  details.website || details.handle ? "" : "pointer-events-none opacity-40"
                }`}
              >
                <Globe className="size-3.5" />
                {tx("Web")}
              </a>
              <a
                href={
                  details.mapsUrl ??
                  `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`
                }
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[11px] font-bold uppercase tracking-widest"
              >
                <Navigation className="size-3.5" />
                {tx("Route")}
              </a>
            </div>
            {details.agentEnabled && details.handle && (
              <div className="mt-2 px-5">
                <a
                  href={`/${details.handle}/agent`}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-[11px] font-bold uppercase tracking-widest text-accent-foreground"
                >
                  <Bot className="size-4" />
                  {tx("Chat with my booking agent")}
                </a>
              </div>
            )}
          </>
        )}

        {!details && !loading && (
          <div className="px-5 py-4 text-[12px] text-muted-foreground">
            <MapPin className="mb-1 size-4 text-accent" />
            {target.address}
          </div>
        )}

        {/* Send the design straight to the studio */}
        <div className="mt-5 px-5">
          {sent ? (
            <p className="flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3 text-[12px]">
              <Check className="size-4 text-accent" />
              {tx("Design sent to")}{" "}{target.name}.
            </p>
          ) : sendOpen ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[12px] font-bold">{tx("Pick a design to send")}</p>
              {motifs.length === 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {tx("You have no saved designs yet — try one on in the camera and it lands here.")}
                </p>
              ) : (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {motifs.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPicked(m.id)}
                      aria-pressed={(picked ?? motifs[0].id) === m.id}
                      className={`size-16 flex-none rounded-xl bg-slate p-1.5 transition ${
                        (picked ?? motifs[0].id) === m.id
                          ? "ring-2 ring-accent"
                          : "ring-1 ring-white/10"
                      }`}
                    >
                      <img
                        src={m.src}
                        alt={m.name}
                        className="h-full w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={motifs.length === 0 || sending}
                onClick={() => void send()}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[12px] font-bold uppercase tracking-widest text-ink disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {tx("Send to studio")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSendOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 text-[12px] font-bold uppercase tracking-widest text-accent"
            >
              <Send className="size-4" />
              {tx("Send my tattoo to this studio")}
            </button>
          )}

          <button
            type="button"
            onClick={() => onBook(target)}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[12px] font-bold uppercase tracking-widest text-ink"
          >
            <Calendar className="size-4" />
            {tx("Request a booking")}
          </button>
        </div>
      </div>
    </div>
  );
}
