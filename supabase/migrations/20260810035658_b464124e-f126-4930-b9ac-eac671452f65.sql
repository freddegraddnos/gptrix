CREATE TABLE public.share_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  motif_id text NOT NULL,
  kind text NOT NULL DEFAULT 'share',
  channel text,
  referrer text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT share_events_kind_chk CHECK (kind IN ('share','open')),
  CONSTRAINT share_events_motif_len_chk CHECK (char_length(motif_id) BETWEEN 1 AND 64),
  CONSTRAINT share_events_channel_len_chk CHECK (channel IS NULL OR char_length(channel) <= 32),
  CONSTRAINT share_events_referrer_len_chk CHECK (referrer IS NULL OR char_length(referrer) <= 200)
);

GRANT INSERT ON public.share_events TO anon, authenticated;
GRANT ALL ON public.share_events TO service_role;

ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a share event"
  ON public.share_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE INDEX share_events_motif_created_idx ON public.share_events (motif_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.top_shared_motifs(_days integer DEFAULT 30, _limit integer DEFAULT 10)
RETURNS TABLE (motif_id text, shares bigint, opens bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.motif_id,
         count(*) FILTER (WHERE e.kind = 'share') AS shares,
         count(*) FILTER (WHERE e.kind = 'open') AS opens
  FROM public.share_events e
  WHERE e.created_at > now() - (GREATEST(LEAST(COALESCE(_days, 30), 365), 1) || ' days')::interval
  GROUP BY e.motif_id
  ORDER BY count(*) DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 10), 50), 1)
$$;

REVOKE ALL ON FUNCTION public.top_shared_motifs(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_shared_motifs(integer, integer) TO authenticated;