ALTER TABLE public.marketplace_motifs ADD COLUMN IF NOT EXISTS usage_terms text;

CREATE OR REPLACE FUNCTION public.enforce_motif_usage_terms()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.price_ore > 0 AND coalesce(length(trim(NEW.usage_terms)), 0) < 10 THEN
    RAISE EXCEPTION 'Designs for sale need usage terms';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS marketplace_motifs_usage_terms ON public.marketplace_motifs;
CREATE TRIGGER marketplace_motifs_usage_terms BEFORE INSERT OR UPDATE ON public.marketplace_motifs
FOR EACH ROW EXECUTE FUNCTION public.enforce_motif_usage_terms();

CREATE TABLE public.studio_help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  query text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.studio_help_requests TO authenticated;
GRANT ALL ON public.studio_help_requests TO service_role;
ALTER TABLE public.studio_help_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studios add own help requests" ON public.studio_help_requests FOR INSERT TO authenticated
  WITH CHECK (studio_id = auth.uid() AND length(message) BETWEEN 1 AND 2000);
CREATE POLICY "Studios read own help requests, admins all" ON public.studio_help_requests FOR SELECT TO authenticated
  USING (studio_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));