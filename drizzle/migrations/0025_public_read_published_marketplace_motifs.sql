GRANT SELECT ON public.marketplace_motifs TO anon;

CREATE POLICY "Anyone can view published motifs"
ON public.marketplace_motifs
FOR SELECT
TO anon
USING (published = true);