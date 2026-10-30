import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyBookingCreated, notifyBookingStatus } from "@/lib/bookings.functions";

export type Booking = {
  id: string;
  user_id: string;
  artist_id: string | null;
  studio_name: string;
  studio_address: string | null;
  studio_place_id: string | null;
  studio_lat: number | null;
  studio_lng: number | null;
  project_id: string | null;
  artist_project_id?: string | null;
  session_number?: number | null;
  preferred_date: string;
  preferred_time: string | null;
  duration_minutes: number | null;
  body_area: string | null;
  size_cm: number | null;
  note: string | null;
  base_photo_url?: string | null;
  intake_answers?: unknown;
  status: "pending" | "confirmed" | "cancelled" | string;
  created_at: string;
};

export type BookingInput = {
  userId: string;
  artistId?: string | null;
  studioName: string;
  studioAddress?: string | null;
  studioPlaceId?: string | null;
  studioLat?: number | null;
  studioLng?: number | null;
  projectId?: string | null;
  preferredDate: string;
  preferredTime?: string | null;
  durationMinutes?: number;
  bodyArea?: string | null;
  sizeCm?: number | null;
  note?: string | null;
  /** Concrete studio calendar slot the client picked, when there is one. */
  slotId?: string | null;
  artistProjectId?: string | null;
  basePhotoUrl?: string | null;
  intakeAnswers?: { question: string; answer: string }[] | null;
};

export async function createBooking(input: BookingInput) {
  if (!input.sizeCm || input.sizeCm <= 0) throw new Error("Motif size is required.");
  if (!input.basePhotoUrl) throw new Error("A customer photo is required.");
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      user_id: input.userId,
      artist_id: input.artistId ?? null,
      studio_name: input.studioName,
      studio_address: input.studioAddress ?? null,
      studio_place_id: input.studioPlaceId ?? null,
      studio_lat: input.studioLat ?? null,
      studio_lng: input.studioLng ?? null,
      project_id: input.projectId ?? null,
      preferred_date: input.preferredDate,
      preferred_time: input.preferredTime ?? null,
      duration_minutes: input.durationMinutes ?? 60,
      body_area: input.bodyArea ?? null,
      size_cm: input.sizeCm ?? null,
      note: input.note ?? null,
      slot_id: input.slotId ?? null,
      artist_project_id: input.artistProjectId ?? null,
      base_photo_url: input.basePhotoUrl ?? null,
      intake_answers: input.intakeAnswers ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  // Fire-and-forget: confirmation to the client, request email to the studio.
  if (data?.id) {
    void notifyBookingCreated({ data: { bookingId: data.id } }).catch(() => undefined);
  }
  return data as Booking;
}

export function useBookings(userId: string | undefined) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  // Start in the loading state so pages don't treat "not fetched yet" as
  // "no bookings" and redirect away before the first query resolves.
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .order("preferred_date", { ascending: false });
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cancel = useCallback(
    async (id: string) => {
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      // Let the studio know the client cancelled.
      void notifyBookingStatus({ data: { bookingId: id, status: "cancelled" } }).catch(
        () => undefined,
      );
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("bookings").delete().eq("id", id);
      await refresh();
    },
    [refresh],
  );

  return { bookings, loading, refresh, cancel, remove };
}

/** Bookings addressed to a studio (artist side). */
export function useArtistBookings(artistId: string | undefined) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!artistId) return setBookings([]);
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("artist_id", artistId)
      .order("preferred_date", { ascending: true });
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, [artistId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setStatus = useCallback(
    async (id: string, status: "confirmed" | "cancelled" | "pending") => {
      setBookings((b) => b.map((x) => (x.id === id ? { ...x, status } : x)));
      await supabase.from("bookings").update({ status }).eq("id", id);
      if (status === "confirmed" || status === "cancelled") {
        // Email the client that the studio confirmed or declined.
        void notifyBookingStatus({ data: { bookingId: id, status } }).catch(() => undefined);
      }
    },
    [],
  );

  return { bookings, loading, refresh, setStatus };
}
