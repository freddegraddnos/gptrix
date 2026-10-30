ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS inapp_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS on_scan boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS on_message boolean NOT NULL DEFAULT true;