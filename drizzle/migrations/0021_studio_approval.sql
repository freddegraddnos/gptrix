ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_token text,
  ADD COLUMN IF NOT EXISTS approval_token_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

-- Existing studios stay live.
UPDATE public.artist_profiles SET approval_status = 'approved', approved_at = now()
WHERE approval_status = 'pending';

CREATE INDEX IF NOT EXISTS artist_profiles_approval_token_idx
  ON public.artist_profiles (approval_token) WHERE approval_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_artists_v2(_q text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _limit integer DEFAULT 30, _styles text[] DEFAULT NULL::text[], _max_price integer DEFAULT NULL::integer, _min_rating numeric DEFAULT NULL::numeric)
 RETURNS TABLE(user_id uuid, handle text, studio_name text, city text, address text, website text, instagram text, bio text, lat double precision, lng double precision, accepts_messages boolean, styles text[], price_level integer, rating numeric, avatar_url text, verified boolean, distance_km double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.user_id, a.handle, a.studio_name, a.city, a.address, a.website, a.instagram, a.bio,
         a.lat, a.lng, a.accepts_messages, a.styles, a.price_level, a.rating, a.avatar_url,
         a.verified,
         CASE WHEN _lat IS NULL OR _lng IS NULL OR a.lat IS NULL OR a.lng IS NULL THEN NULL
              ELSE 6371 * acos(LEAST(1, GREATEST(-1,
                cos(radians(_lat)) * cos(radians(a.lat)) * cos(radians(a.lng) - radians(_lng))
                + sin(radians(_lat)) * sin(radians(a.lat)))))
         END AS distance_km
  FROM public.artist_profiles a
  WHERE a.status = 'approved'
    AND a.approval_status = 'approved'
    AND a.handle IS NOT NULL
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
  LIMIT GREATEST(LEAST(COALESCE(_limit, 30), 100), 1);
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
      AND approval_status = 'approved'
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
    'opening_hours', a.opening_hours,
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