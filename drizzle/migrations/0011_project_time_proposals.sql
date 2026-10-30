CREATE TABLE public.project_time_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES auth.users(id),
  proposed_date date NOT NULL,
  time_window text NOT NULL CHECK (time_window IN ('morning','afternoon','evening')),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','declined')),
  responded_at timestamptz,
  booking_id uuid REFERENCES public.bookings(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_time_proposals_project_idx ON public.project_time_proposals(project_id, status);
GRANT SELECT, INSERT, UPDATE ON public.project_time_proposals TO authenticated;
GRANT ALL ON public.project_time_proposals TO service_role;
ALTER TABLE public.project_time_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties can read time proposals"
  ON public.project_time_proposals FOR SELECT TO authenticated
  USING (public.is_artist_project_party(project_id, auth.uid()));
CREATE POLICY "Customer can propose a time"
  ON public.project_time_proposals FOR INSERT TO authenticated
  WITH CHECK (
    proposed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.artist_client_projects p
      WHERE p.id = project_id AND p.client_user_id = auth.uid()
    )
  );
CREATE POLICY "Studio staff respond to proposals"
  ON public.project_time_proposals FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_client_projects p
      WHERE p.id = project_id AND public.is_studio_staff(p.artist_id, auth.uid())
    )
  );