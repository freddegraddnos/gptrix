
CREATE TABLE public.body_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body_part text,
  status text NOT NULL DEFAULT 'uploaded',
  provider_task_id text,
  video_path text NOT NULL,
  still_path text,
  model_path text,
  scale_factor numeric,
  scale_confidence numeric,
  calibrated boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_scans TO authenticated;
GRANT ALL ON public.body_scans TO service_role;

ALTER TABLE public.body_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scans" ON public.body_scans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER body_scans_updated_at BEFORE UPDATE ON public.body_scans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX body_scans_user_idx ON public.body_scans (user_id, created_at DESC);

-- Storage: användarens egen mapp i "scans"
CREATE POLICY "Users read own scan files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'scans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own scan files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own scan files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'scans' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own scan files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'scans' AND auth.uid()::text = (storage.foldername(name))[1]);
