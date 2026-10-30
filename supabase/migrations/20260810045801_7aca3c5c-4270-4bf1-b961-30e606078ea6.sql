-- 1. Try-on history
CREATE TABLE public.tryon_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motif_id text,
  motif_name text,
  body_part text,
  pose text,
  width_cm numeric,
  rotation numeric,
  transform jsonb,
  preview_url text,
  session_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tryon_history TO authenticated;
GRANT ALL ON public.tryon_history TO service_role;
ALTER TABLE public.tryon_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tryon history" ON public.tryon_history
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tryon_history_user_created_idx ON public.tryon_history (user_id, created_at DESC);

-- 2. Project workspace fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS artist_user_id uuid,
  ADD COLUMN IF NOT EXISTS artist_name text,
  ADD COLUMN IF NOT EXISTS booking_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS placement_note text;

CREATE TABLE public.project_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'reference',
  title text,
  note text,
  image_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assets TO authenticated;
GRANT ALL ON public.project_assets TO service_role;
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project assets" ON public.project_assets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX project_assets_project_idx ON public.project_assets (project_id, created_at DESC);

CREATE TABLE public.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.project_versions TO authenticated;
GRANT ALL ON public.project_versions TO service_role;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project versions" ON public.project_versions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX project_versions_project_idx ON public.project_versions (project_id, created_at DESC);

-- 3. Artist filters
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS styles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS price_level integer,
  ADD COLUMN IF NOT EXISTS rating numeric,
  ADD COLUMN IF NOT EXISTS avatar_url text;

DROP FUNCTION IF EXISTS public.search_artists(text, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION public.search_artists(
  _q text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _limit integer DEFAULT 30,
  _styles text[] DEFAULT NULL,
  _max_price integer DEFAULT NULL,
  _min_rating numeric DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid, studio_name text, city text, address text, website text,
  instagram text, bio text, lat double precision, lng double precision,
  accepts_messages boolean, styles text[], price_level integer,
  rating numeric, avatar_url text, distance_km double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.user_id, a.studio_name, a.city, a.address, a.website, a.instagram, a.bio,
         a.lat, a.lng, a.accepts_messages, a.styles, a.price_level, a.rating, a.avatar_url,
         CASE WHEN _lat IS NULL OR _lng IS NULL OR a.lat IS NULL OR a.lng IS NULL THEN NULL
              ELSE 6371 * acos(LEAST(1, GREATEST(-1,
                cos(radians(_lat)) * cos(radians(a.lat)) * cos(radians(a.lng) - radians(_lng))
                + sin(radians(_lat)) * sin(radians(a.lat)))))
         END AS distance_km
  FROM public.artist_profiles a
  WHERE a.status = 'approved'
    AND (
      _q IS NULL OR btrim(_q) = '' OR
      a.studio_name ILIKE '%' || _q || '%' OR
      COALESCE(a.city, '') ILIKE '%' || _q || '%' OR
      COALESCE(a.address, '') ILIKE '%' || _q || '%'
    )
    AND (_styles IS NULL OR array_length(_styles, 1) IS NULL OR a.styles && _styles)
    AND (_max_price IS NULL OR (a.price_level IS NOT NULL AND a.price_level <= _max_price))
    AND (_min_rating IS NULL OR (a.rating IS NOT NULL AND a.rating >= _min_rating))
  ORDER BY distance_km ASC NULLS LAST, a.studio_name ASC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 30), 100), 1)
$function$;

REVOKE ALL ON FUNCTION public.search_artists(text, double precision, double precision, integer, text[], integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_artists(text, double precision, double precision, integer, text[], integer, numeric) TO authenticated, service_role;