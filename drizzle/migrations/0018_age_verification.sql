CREATE TABLE public.artist_project_age_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  min_age integer NOT NULL DEFAULT 18,
  status text NOT NULL DEFAULT 'open',
  storage_path text,
  birth_year integer,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_project_age_verifications_status_check CHECK (status IN ('open','submitted','approved','rejected')),
  CONSTRAINT artist_project_age_verifications_min_age_check CHECK (min_age BETWEEN 16 AND 30)
);

GRANT SELECT, INSERT, UPDATE ON public.artist_project_age_verifications TO authenticated;
GRANT ALL ON public.artist_project_age_verifications TO service_role;

ALTER TABLE public.artist_project_age_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project parties read age verification"
ON public.artist_project_age_verifications FOR SELECT TO authenticated
USING (public.is_artist_project_party(project_id, auth.uid()));

CREATE POLICY "Project parties write age verification"
ON public.artist_project_age_verifications FOR INSERT TO authenticated
WITH CHECK (public.is_artist_project_party(project_id, auth.uid()));

CREATE POLICY "Project parties update age verification"
ON public.artist_project_age_verifications FOR UPDATE TO authenticated
USING (public.is_artist_project_party(project_id, auth.uid()))
WITH CHECK (public.is_artist_project_party(project_id, auth.uid()));

CREATE TRIGGER set_age_verification_updated_at
BEFORE UPDATE ON public.artist_project_age_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS age_verification_status text NOT NULL DEFAULT 'none';