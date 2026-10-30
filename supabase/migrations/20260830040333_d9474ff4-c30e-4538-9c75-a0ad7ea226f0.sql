DROP POLICY IF EXISTS "Users can claim an open slot" ON public.studio_slots;
CREATE POLICY "Users can request an open slot"
ON public.studio_slots
FOR UPDATE
TO authenticated
USING (status = 'open')
WITH CHECK (booked_by = auth.uid() AND status = 'requested');