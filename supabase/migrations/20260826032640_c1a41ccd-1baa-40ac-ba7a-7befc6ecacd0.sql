ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS artist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_artist_id_idx ON public.bookings(artist_id);
DROP POLICY IF EXISTS "Artists can view bookings sent to them" ON public.bookings;
CREATE POLICY "Artists can view bookings sent to them" ON public.bookings FOR SELECT TO authenticated USING (artist_id = auth.uid());
DROP POLICY IF EXISTS "Artists can update bookings sent to them" ON public.bookings;
CREATE POLICY "Artists can update bookings sent to them" ON public.bookings FOR UPDATE TO authenticated USING (artist_id = auth.uid()) WITH CHECK (artist_id = auth.uid());

ALTER TABLE public.scan_shares ADD COLUMN IF NOT EXISTS artist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS scan_shares_artist_id_idx ON public.scan_shares(artist_id);
DROP POLICY IF EXISTS "Artists can view scans shared with them" ON public.scan_shares;
CREATE POLICY "Artists can view scans shared with them" ON public.scan_shares FOR SELECT TO authenticated USING (artist_id = auth.uid());