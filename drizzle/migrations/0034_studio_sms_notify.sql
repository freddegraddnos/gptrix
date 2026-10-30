ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS notify_phone text,
  ADD COLUMN IF NOT EXISTS notify_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms_enabled boolean NOT NULL DEFAULT false;