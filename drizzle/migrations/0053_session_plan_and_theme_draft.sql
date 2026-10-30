ALTER TABLE public.artist_client_projects ADD COLUMN IF NOT EXISTS session_plan integer[];
ALTER TABLE public.artist_client_projects ADD COLUMN IF NOT EXISTS booking_link_session_plan integer[];
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS theme_draft jsonb;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS theme_draft_updated_at timestamptz;
COMMENT ON COLUMN public.artist_client_projects.session_plan IS 'Minutes per session in order; null means every session uses session_minutes.';
COMMENT ON COLUMN public.artist_profiles.theme_draft IS 'Unpublished studio page theme; public page reads theme only.';