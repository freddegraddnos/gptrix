ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS contact_email text;

ALTER TABLE public.studio_slots
  ADD COLUMN IF NOT EXISTS scan_path text,
  ADD COLUMN IF NOT EXISTS scan_bucket text NOT NULL DEFAULT 'scans',
  ADD COLUMN IF NOT EXISTS scan_name text,
  ADD COLUMN IF NOT EXISTS scan_note text,
  ADD COLUMN IF NOT EXISTS scan_by uuid,
  ADD COLUMN IF NOT EXISTS scan_delivered_at timestamptz;

ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'booking';