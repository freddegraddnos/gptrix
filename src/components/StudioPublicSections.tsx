import { Link } from "@tanstack/react-router";
import { useStudioAccount } from "@/hooks/useStudioAccount";
import { StudioAccountNotice } from "@/components/StudioAccountNotice";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Instagram, Loader2, Percent } from "lucide-react";
import {
  useStudioDeals,
  useStudioGallery,
  usePublicSlots,
  useStudioTeam,
  useMySlotBookings,
} from "@/hooks/useStudio";
import { notifySlotBooking } from "@/lib/bookings.functions";
import { toast } from "sonner";
import { studioImageUrls } from "@/lib/studioMedia";
import { WatermarkedImage } from "@/components/InkWatermark";
import { useAuth } from "@/hooks/useAuth";
import { SlotBookingCard } from "@/components/SlotBookingCard";
import { logSlotEvent } from "@/lib/slotEvents";
import { requestReplacement } from "@/lib/slotRequests";

import { tx, useUiLang } from "@/lib/uiLang";
/** Public studio surfaces: team, gallery, offers and bookable slots. */
export function StudioPublicSections({
  studioId,
  openingHours,
}: {
  studioId: string;
  openingHours?: string | null;
}) {
  const sv = useUiLang() === "sv";
  const { user } = useAuth();
  const studioAcct = useStudioAccount();
  const [studioBlocked, setStudioBlocked] = useState(false);
  const { team, loading: teamLoading } = useStudioTeam(studioId);
  const { items, urls, loading: galleryLoading } = useStudioGallery(studioId);
  const { deals } = useStudioDeals(studioId, true);
  const { slots, loading: slotsLoading, error: slotsError, claim, refresh: refreshSlots } = usePublicSlots(studioId, true);
  const {
    slots: mySlots,
    refresh: refreshMine,
    cancel,
    respondToProposal,
  } = useMySlotBookings(user?.id);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [rescheduleFrom, setRescheduleFrom] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState("all");
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    void studioImageUrls(team.map((t) => t.avatar_url)).then(setAvatars);
  }, [team]);

  const activeTeam = useMemo(() => team.filter((t) => t.active), [team]);
  const gallery = items.filter((i) => artistFilter === "all" || i.member_id === artistFilter);
  // Requested and proposed slots are held for that client, so they never show
  // up as available for anyone else.
  const openSlots = slots.filter(
    (s) => s.status === "open" && (artistFilter === "all" || s.member_id === artistFilter),
  );
  const shownDeals = deals.filter(
    (d) => artistFilter === "all" || d.member_id === artistFilter || d.member_id === null,
  );
  const nameOf = (id: string | null) =>
    id ? (team.find((t) => t.id === id)?.name ?? "Artist") : "The studio";

  if (teamLoading && galleryLoading) {
    return <Loader2 className="mx-auto mt-6 size-5 animate-spin text-accent" />;
  }

  const myStudioSlots = mySlots.filter((s) => s.studio_id === studioId);

  const bookSlot = async (slotId: string) => {
    if (!user) return;
    if (studioAcct.loading) return;
    if (studioAcct.isStudio) {
      setStudioBlocked(true);
      return;
    }
    setBusySlot(slotId);
    try {
      const { data: adult } = await supabase.rpc("booking_adult_declared", { _user: user.id });
      if (!adult) throw new Error(tx("You must be 18 or older to request a time. Confirm your age in your profile."));
      const replacement = await requestReplacement(
        () => claim(slotId, user.id),
        rescheduleFrom ? () => cancel(rescheduleFrom) : undefined,
      );
      if (!replacement.previousReleased) {
        toast.error(sv ? "Den nya tiden är begärd men den tidigare tiden kunde inte avbokas. Kontrollera dina tider." : "The new time was requested, but the previous time could not be cancelled. Check your appointments.");
        setRescheduleFrom(null);
        await Promise.all([refreshSlots(), refreshMine()]);
        return;
      }
      if (rescheduleFrom) void notifySlotBooking({ data: { slotId: rescheduleFrom, action: "rescheduled" } });
      await logSlotEvent({ slotId, role: "client", action: "requested" });
      void notifySlotBooking({ data: { slotId, action: "requested" } });
      toast.success(
        rescheduleFrom
          ? "New time requested — the studio confirms it shortly."
          : "Request sent — your booking is confirmed once the studio accepts it.",
      );
      setRescheduleFrom(null);
      await Promise.all([refreshSlots(), refreshMine()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not book that time.");
    } finally {
      setBusySlot(null);
    }
  };

  const cancelSlot = async (slotId: string) => {
    setBusySlot(slotId);
    try {
      void notifySlotBooking({ data: { slotId, action: "cancelled" } });
      await logSlotEvent({ slotId, role: "client", action: "cancelled" });
      await cancel(slotId);
      toast.success(tx("Appointment cancelled."));
      await refreshSlots();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel.");
    } finally {
      setBusySlot(null);
    }
  };

  // Keep an availability section even when no other studio content is published.

  return (
    <div className="mt-8 space-y-8">
      {activeTeam.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">{tx("Artists")}</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {activeTeam.map((t) => (
              <button
                key={t.id}
                onClick={() => setArtistFilter(artistFilter === t.id ? "all" : t.id)}
                className={`w-28 shrink-0 rounded-2xl border p-3 text-center ${
                  artistFilter === t.id
                    ? "border-accent/60 bg-accent/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="mx-auto size-14 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  {t.avatar_url && avatars[t.avatar_url] ? (
                    <img
                      src={avatars[t.avatar_url]}
                      alt={t.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-bold text-accent">
                      {t.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="mt-2 truncate text-xs font-semibold">{t.name}</div>
                {t.role && (
                  <div className="truncate text-[10px] text-muted-foreground">{t.role}</div>
                )}
                {t.instagram && (
                  <Instagram className="mx-auto mt-1 size-3 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
          {artistFilter !== "all" && (
            <button
              onClick={() => setArtistFilter("all")}
              className="text-[11px] uppercase tracking-widest text-accent"
            >
              {tx("Show the whole studio")}
            </button>
          )}
        </section>
      )}

      {gallery.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
            {tx("Finished tattoos")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {gallery.map((g) => (
              <figure key={g.id} className="overflow-hidden rounded-2xl border border-white/10">
                {urls[g.image_url] && (
                  <WatermarkedImage
                    src={urls[g.image_url] as string}
                    alt={g.caption ?? tx("Tattoo by {name}", { name: nameOf(g.member_id) })}
                    watermark
                    className="aspect-square"
                  />
                )}
                <figcaption className="p-2 text-[11px] text-muted-foreground">
                  {g.caption ?? nameOf(g.member_id)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {shownDeals.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">{tx("Offers")}</h2>
          <div className="mt-3 space-y-2">
            {shownDeals.map((d) => (
              <div key={d.id} className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
                <div className="flex items-center gap-2">
                  <Percent className="size-4 text-accent" />
                  <span className="flex-1 font-semibold">{d.title}</span>
                  {d.discount_percent != null && (
                    <span className="text-sm font-bold text-accent">-{d.discount_percent}%</span>
                  )}
                </div>
                {d.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {nameOf(d.member_id)}
                  {d.ends_at ? ` · until ${new Date(d.ends_at).toLocaleDateString()}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {openingHours && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
            {tx("Opening hours")}
          </h2>
          <p className="mt-2 whitespace-pre-line rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
            {openingHours}
          </p>
        </section>
      )}

      {myStudioSlots.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
            {tx("Your appointments")}
          </h2>
          <ul className="mt-3 space-y-2">
            {myStudioSlots.map((s) => (
              <SlotBookingCard
                key={s.id}
                slot={s}
                artistName={nameOf(s.member_id)}
                moving={rescheduleFrom === s.id}
                onMove={() => setRescheduleFrom((cur) => (cur === s.id ? null : s.id))}
                cancelBusy={busySlot === s.id}
                onCancel={() => void cancelSlot(s.id)}
                respond={respondToProposal}
                onChanged={async () => {
                  await Promise.all([refreshSlots(), refreshMine()]);
                }}
              />
            ))}
          </ul>
        </section>
      )}

      <section id="available-times" className="scroll-mt-24">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
            {tx("Available times")}
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {sv ? "En tidsförfrågan är inte en bokning. Studion behöver först acceptera den." : "A time request is not a booking. The studio must accept it first."}
          </p>
          {slotsLoading ? <p className="mt-2 text-sm text-muted-foreground">{tx("Loading…")}</p> : slotsError ? <div role="alert" className="mt-2 text-sm"><p>{sv ? "Lediga tider kunde inte hämtas." : "Available times could not be loaded."}</p><button type="button" className="min-h-11 text-accent underline" onClick={() => void refreshSlots()}>{tx("Try again")}</button></div> : openSlots.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{artistFilter !== "all" ? (sv ? "Inga lediga tider för denna artist just nu." : "No available times for this artist right now.") : (sv ? "Inga lediga tider just nu. Kontakta studion för att fråga om tider." : "No available times right now. Contact the studio to ask about availability.")}</p> : null}
          {studioBlocked && (
            <div className="mt-3">
              <StudioAccountNotice studioName={studioAcct.studioName} onClose={() => setStudioBlocked(false)} />
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {openSlots.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <CalendarClock className="size-4 text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {new Date(s.starts_at).toLocaleString()}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {nameOf(s.member_id)} · {s.duration_minutes} min
                    {s.price_ore != null ? ` · ${Math.round(s.price_ore / 100)} kr` : ""}
                  </div>
                  {s.requires_3d && (
                    <div className="mt-1 text-[11px] text-accent">
                      {tx("3D body scan required — scan yourself in the app before the session.")}
                    </div>
                  )}
                </div>
                {user ? (
                  <button
                    disabled={busySlot === s.id}
                    onClick={() => void bookSlot(s.id)}
                    className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
                  >
                    {busySlot === s.id ? "…" : rescheduleFrom ? tx("Request move") : tx("Request")}
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    search={{
                      redirect: typeof window !== "undefined" ? window.location.pathname : undefined,
                    }}
                    className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black"
                  >
                    {sv ? "Logga in för att begära tiden" : "Sign in to request"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
    </div>
  );
}
