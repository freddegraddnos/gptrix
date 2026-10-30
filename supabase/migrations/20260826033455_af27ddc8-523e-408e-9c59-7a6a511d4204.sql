ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS document_path text,
  ADD COLUMN IF NOT EXISTS document_submitted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.artist_email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.artist_email_otps TO service_role;
ALTER TABLE public.artist_email_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.artist_email_otps FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS artist_email_otps_user_idx ON public.artist_email_otps (artist_user_id, created_at DESC);

CREATE POLICY "Studios upload own verification docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'verification' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Studios read own verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'verification' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP FUNCTION IF EXISTS public.search_artists(text, double precision, double precision, integer, text[], integer, numeric);

CREATE OR REPLACE FUNCTION public.search_artists(_q text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _limit integer DEFAULT 30, _styles text[] DEFAULT NULL::text[], _max_price integer DEFAULT NULL::integer, _min_rating numeric DEFAULT NULL::numeric)
 RETURNS TABLE(user_id uuid, studio_name text, city text, address text, website text, instagram text, bio text, lat double precision, lng double precision, accepts_messages boolean, styles text[], price_level integer, rating numeric, avatar_url text, verified boolean, distance_km double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.user_id, a.studio_name, a.city, a.address, a.website, a.instagram, a.bio,
         a.lat, a.lng, a.accepts_messages, a.styles, a.price_level, a.rating, a.avatar_url,
         a.verified,
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
  ORDER BY a.verified DESC, distance_km ASC NULLS LAST, a.studio_name ASC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 30), 100), 1)
$function$;

CREATE OR REPLACE FUNCTION public.public_artist_page(_handle text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH a AS (
    SELECT * FROM public.artist_profiles
    WHERE handle IS NOT NULL AND lower(handle) = lower(_handle)
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'user_id', a.user_id,
    'handle', a.handle,
    'studio_name', a.studio_name,
    'city', a.city,
    'address', a.address,
    'bio', a.bio,
    'website', a.website,
    'instagram', a.instagram,
    'avatar_url', a.avatar_url,
    'styles', to_jsonb(a.styles),
    'price_level', a.price_level,
    'rating', a.rating,
    'review_count', a.review_count,
    'accepts_messages', a.accepts_messages,
    'verified', a.verified,
    'design_count', (
      SELECT count(*)::int FROM public.artist_client_projects p WHERE p.artist_id = a.user_id
    ),
    'showcase', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title,
        'before_url', p.before_url, 'after_url', p.after_url,
        'created_at', p.created_at
      ) ORDER BY p.created_at DESC)
      FROM public.artist_client_projects p
      WHERE p.artist_id = a.user_id
        AND p.publish_approved = true
        AND p.after_url IS NOT NULL
    ), '[]'::jsonb)
  )
  FROM a;
$function$;