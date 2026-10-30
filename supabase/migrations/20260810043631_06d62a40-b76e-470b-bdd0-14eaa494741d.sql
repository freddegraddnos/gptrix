ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_path text;

CREATE TABLE IF NOT EXISTS public.artist_sketches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_sketches TO authenticated;
GRANT ALL ON public.artist_sketches TO service_role;

ALTER TABLE public.artist_sketches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists manage their own sketches"
ON public.artist_sketches FOR ALL TO authenticated
USING (auth.uid() = artist_id)
WITH CHECK (auth.uid() = artist_id);

CREATE TRIGGER artist_sketches_updated_at
BEFORE UPDATE ON public.artist_sketches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();