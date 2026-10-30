CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL CHECK (event IN ('ar_started','photo_uploaded','design_saved','shared','studio_clicked')),
  anon_id text,
  user_id uuid,
  path text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone logs own events" ON public.analytics_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Admins read events" ON public.analytics_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX analytics_events_created_idx ON public.analytics_events (created_at DESC, event);

ALTER TABLE public.artist_client_projects ADD COLUMN studio_read_at timestamptz;
CREATE POLICY "Admins read all requests" ON public.artist_client_projects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));