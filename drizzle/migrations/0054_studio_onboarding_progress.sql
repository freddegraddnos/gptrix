ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_details_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_email text,
  ADD COLUMN IF NOT EXISTS notify_test_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_test_sms_at timestamptz;