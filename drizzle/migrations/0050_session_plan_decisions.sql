ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS booking_link_sending_at timestamptz,
  ADD COLUMN IF NOT EXISTS more_times_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS more_times_request_note text,
  ADD COLUMN IF NOT EXISTS more_times_notified_at timestamptz;