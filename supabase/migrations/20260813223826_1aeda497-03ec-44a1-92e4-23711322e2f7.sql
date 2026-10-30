CREATE TABLE public.scan_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.body_scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  sketch_path text,
  sketch_bucket text,
  note text,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_shares TO authenticated;
GRANT ALL ON public.scan_shares TO service_role;

ALTER TABLE public.scan_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scan shares" ON public.scan_shares
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX scan_shares_token_idx ON public.scan_shares (token);
CREATE INDEX scan_shares_scan_idx ON public.scan_shares (scan_id, created_at DESC);