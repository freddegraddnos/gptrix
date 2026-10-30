ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS booking_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_link_session_count integer,
  ADD COLUMN IF NOT EXISTS booking_link_session_minutes integer;