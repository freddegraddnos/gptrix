ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS quiet_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_start time NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end time NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS quiet_tz text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS quiet_scope text NOT NULL DEFAULT 'push';

CREATE TABLE IF NOT EXISTS public.booking_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.studio_slots(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_role text NOT NULL DEFAULT 'studio',
  name text NOT NULL,
  path text NOT NULL,
  bucket text NOT NULL DEFAULT 'attachments',
  mime_type text,
  size_bytes bigint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_files TO authenticated;
GRANT ALL ON public.booking_files TO service_role;

ALTER TABLE public.booking_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking parties can view files"
ON public.booking_files FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.studio_slots s
  WHERE s.id = booking_files.slot_id
    AND (s.studio_id = auth.uid() OR s.booked_by = auth.uid())
));

CREATE POLICY "Booking parties can add files"
ON public.booking_files FOR INSERT TO authenticated
WITH CHECK (uploader_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.studio_slots s
  WHERE s.id = booking_files.slot_id
    AND (s.studio_id = auth.uid() OR s.booked_by = auth.uid())
));

CREATE POLICY "Uploader can update own files"
ON public.booking_files FOR UPDATE TO authenticated
USING (uploader_id = auth.uid())
WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "Uploader can delete own files"
ON public.booking_files FOR DELETE TO authenticated
USING (uploader_id = auth.uid());

CREATE TRIGGER booking_files_updated_at
BEFORE UPDATE ON public.booking_files
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS booking_files_slot_idx ON public.booking_files(slot_id, created_at DESC);