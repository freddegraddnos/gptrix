ALTER TABLE public.marketplace_motifs ADD COLUMN IF NOT EXISTS style text;

CREATE OR REPLACE FUNCTION public.is_approved_studio(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.artist_profiles
    WHERE user_id = _user AND approval_status = 'approved'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_studio(uuid) TO authenticated;

DROP POLICY IF EXISTS "Artists create own motifs" ON public.marketplace_motifs;

CREATE POLICY "Approved studios create own motifs"
ON public.marketplace_motifs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = artist_id AND public.is_approved_studio(auth.uid()));
