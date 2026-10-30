ALTER TABLE public.marketplace_motifs ADD COLUMN IF NOT EXISTS placements text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.marketplace_motifs ADD COLUMN IF NOT EXISTS coverage text NOT NULL DEFAULT 'single';
CREATE OR REPLACE FUNCTION public.validate_motif_placement() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.coverage NOT IN ('single','half_sleeve','full_sleeve') THEN
    RAISE EXCEPTION 'Invalid coverage';
  END IF;
  IF NEW.coverage <> 'single' AND cardinality(NEW.placements) > 0
     AND NOT (NEW.placements && ARRAY['arm','leg']) THEN
    RAISE EXCEPTION 'A sleeve needs arm or leg as placement';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_motif_placement ON public.marketplace_motifs;
CREATE TRIGGER trg_validate_motif_placement BEFORE INSERT OR UPDATE ON public.marketplace_motifs
FOR EACH ROW EXECUTE FUNCTION public.validate_motif_placement();