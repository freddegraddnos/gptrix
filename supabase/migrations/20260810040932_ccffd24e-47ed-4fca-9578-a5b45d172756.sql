ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS accepts_messages boolean NOT NULL DEFAULT true;

ALTER TABLE public.artist_profiles ALTER COLUMN status SET DEFAULT 'approved';
UPDATE public.artist_profiles SET status = 'approved' WHERE status = 'pending';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_message_notifications boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.search_artists(
  _q text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS TABLE(
  user_id uuid,
  studio_name text,
  city text,
  address text,
  website text,
  instagram text,
  bio text,
  lat double precision,
  lng double precision,
  accepts_messages boolean,
  distance_km double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.user_id, a.studio_name, a.city, a.address, a.website, a.instagram, a.bio,
         a.lat, a.lng, a.accepts_messages,
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
  ORDER BY distance_km ASC NULLS LAST, a.studio_name ASC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 30), 100), 1)
$$;

REVOKE ALL ON FUNCTION public.search_artists(text, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_artists(text, double precision, double precision, integer) TO authenticated;