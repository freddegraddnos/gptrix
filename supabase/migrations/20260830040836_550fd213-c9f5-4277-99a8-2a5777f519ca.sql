ALTER TABLE public.studio_slots
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS proposed_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS public.slot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.studio_slots(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  actor_role text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slot_events_slot_idx ON public.slot_events(slot_id, created_at);

GRANT SELECT, INSERT ON public.slot_events TO authenticated;
GRANT ALL ON public.slot_events TO service_role;

ALTER TABLE public.slot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read slot events"
ON public.slot_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.studio_slots s
    WHERE s.id = slot_events.slot_id
      AND (s.booked_by = auth.uid() OR public.is_studio_admin(s.studio_id, auth.uid()))
  )
);

CREATE POLICY "Participants write slot events"
ON public.slot_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.studio_slots s
    WHERE s.id = slot_events.slot_id
      AND (s.booked_by = auth.uid() OR public.is_studio_admin(s.studio_id, auth.uid()))
  )
);