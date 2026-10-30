CREATE OR REPLACE FUNCTION public.is_booking_party(_slot uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.studio_slots s
    WHERE s.id = _slot AND (s.studio_id = _user OR s.booked_by = _user)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) FROM anon;

CREATE POLICY "Booking parties read booking files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'booking'
  AND public.is_booking_party(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "Booking parties upload booking files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'booking'
  AND public.is_booking_party(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "Booking parties delete booking files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = 'booking'
  AND owner = auth.uid()
);