ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS request_group_id uuid,
  ADD COLUMN IF NOT EXISTS sent_to_multiple boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS artist_client_projects_request_group_idx
  ON public.artist_client_projects (request_group_id);