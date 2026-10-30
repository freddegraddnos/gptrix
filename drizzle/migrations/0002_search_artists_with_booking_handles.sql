CREATE OR REPLACE FUNCTION public.search_artists_v2(_q text DEFAULT NULL::text, _lat double precision DEFAULT NULL::double precision, _lng double precision DEFAULT NULL::double precision, _limit integer DEFAULT 30, _styles text[] DEFAULT NULL::text[], _max_price integer DEFAULT NULL::integer, _min_rating numeric DEFAULT NULL::numeric)
RETURNS TABLE(user_id uuid, handle text, studio_name text, city text, address text, website text, instagram text, bio text, lat double precision, lng double precision, accepts_messages boolean, styles text[], price_level integer, rating numeric, avatar_url text, verified boolean, distance_km double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.search_artists_v2(text, double precision, double precision, integer, text[], integer, numeric) TO authenticated;