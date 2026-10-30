CREATE OR REPLACE FUNCTION public.is_any_studio_account(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.artist_profiles WHERE user_id = _user)
    OR EXISTS (SELECT 1 FROM public.studio_members WHERE user_id = _user AND status = 'active')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_any_studio_account(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "own bookings insert" ON public.bookings;
CREATE POLICY "own bookings insert" ON public.bookings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (NOT public.is_any_studio_account(auth.uid())
       OR (artist_id IS NOT NULL AND public.is_studio_staff(artist_id, auth.uid())))
);

DROP POLICY IF EXISTS "Users can request an open slot" ON public.studio_slots;
CREATE POLICY "Users can request an open slot" ON public.studio_slots
FOR UPDATE TO authenticated
USING (status = 'open'::text)
WITH CHECK (
  booked_by = auth.uid() AND status = 'requested'::text
  AND (NOT public.is_any_studio_account(auth.uid()) OR public.is_studio_staff(studio_id, auth.uid()))
);

CREATE OR REPLACE FUNCTION public.enforce_booking_consistency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.studio_slots s WHERE s.id = NEW.slot_id AND s.studio_id = NEW.artist_id
  ) THEN
    RAISE EXCEPTION 'Booking slot does not belong to this studio';
  END IF;
  IF NEW.artist_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.artist_client_projects p WHERE p.id = NEW.artist_project_id AND p.artist_id = NEW.artist_id
  ) THEN
    RAISE EXCEPTION 'Booking project does not belong to this studio';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_booking_consistency ON public.bookings;
CREATE TRIGGER enforce_booking_consistency
BEFORE INSERT OR UPDATE OF slot_id, artist_project_id, artist_id ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_consistency();