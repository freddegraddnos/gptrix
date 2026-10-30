ALTER TABLE public.artist_project_messages
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;