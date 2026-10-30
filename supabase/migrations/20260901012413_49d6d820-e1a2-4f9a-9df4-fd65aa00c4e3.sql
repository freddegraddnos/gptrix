CREATE TABLE public.matching_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Matching design',
  image_data TEXT NOT NULL,
  width_cm NUMERIC,
  rotation NUMERIC,
  message TEXT,
  sender_name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX matching_designs_created_by_idx ON public.matching_designs (created_by);

GRANT SELECT ON public.matching_designs TO authenticated;
GRANT ALL ON public.matching_designs TO service_role;

ALTER TABLE public.matching_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Senders can see their own matching links"
  ON public.matching_designs FOR SELECT TO authenticated
  USING (created_by = auth.uid());