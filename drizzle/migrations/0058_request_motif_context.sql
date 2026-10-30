-- Immutable provenance for a customer's chosen marketplace design.
-- No original file is copied and no editing/download/reservation rights are granted.
ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS source_motif_id uuid REFERENCES public.marketplace_motifs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_motif_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.protect_request_motif_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.source_motif_id IS DISTINCT FROM NEW.source_motif_id
    AND NOT (NEW.source_motif_id IS NULL AND pg_trigger_depth() > 1) THEN
    RAISE EXCEPTION 'The sent design identity is immutable';
  END IF;
  IF OLD.source_motif_snapshot IS DISTINCT FROM NEW.source_motif_snapshot THEN
    RAISE EXCEPTION 'The sent design snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_request_motif_snapshot ON public.artist_client_projects;
CREATE TRIGGER protect_request_motif_snapshot BEFORE UPDATE OF source_motif_id, source_motif_snapshot
  ON public.artist_client_projects FOR EACH ROW EXECUTE FUNCTION public.protect_request_motif_snapshot();
