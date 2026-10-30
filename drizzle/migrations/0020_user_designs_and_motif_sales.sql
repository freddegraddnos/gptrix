CREATE TABLE public.user_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Custom motif',
  kind TEXT NOT NULL DEFAULT 'upload',
  storage_path TEXT NOT NULL,
  width_cm NUMERIC NOT NULL DEFAULT 8,
  local_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_designs_kind_check CHECK (kind IN ('upload','drawing','text','ai','sleeve')),
  CONSTRAINT user_designs_local_unique UNIQUE (user_id, local_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_designs TO authenticated;
GRANT ALL ON public.user_designs TO service_role;

ALTER TABLE public.user_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own designs" ON public.user_designs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own designs" ON public.user_designs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own designs" ON public.user_designs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own designs" ON public.user_designs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX user_designs_user_created_idx ON public.user_designs (user_id, created_at DESC);

CREATE POLICY "Users read own design files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'designs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own design files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'designs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own design files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'designs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.owns_motif(_motif UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marketplace_motifs m
    WHERE m.id = _motif AND m.artist_id = _user
  )
$$;

CREATE POLICY "Artists read sales of their motifs" ON public.motif_purchases
  FOR SELECT TO authenticated
  USING (public.owns_motif(motif_id, auth.uid()));
