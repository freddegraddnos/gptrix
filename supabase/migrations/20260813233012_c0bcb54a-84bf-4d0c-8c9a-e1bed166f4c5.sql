CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  username text,
  profile_url text,
  is_public boolean NOT NULL DEFAULT true,
  method text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own social connections"
ON public.social_connections FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_social_connections_updated_at
BEFORE UPDATE ON public.social_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.public_profile_page(_handle text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH p AS (
    SELECT * FROM public.profiles
    WHERE lower(handle) = lower(_handle)
    LIMIT 1
  ), priv AS (
    SELECT
      coalesce(p.tab_privacy->>'tattoos', 'public') AS tattoos,
      coalesce(p.tab_privacy->>'designs', 'public') AS designs,
      coalesce(p.tab_privacy->>'considering', 'private') AS considering,
      coalesce(p.tab_privacy->>'collections', 'public') AS collections
    FROM p
  ), items AS (
    SELECT pr.id, pr.name, pr.cover_url, pr.preview_url, pr.tattoo_name,
           pr.body_part, pr.width_cm, pr.shelf, pr.collection, pr.created_at
    FROM public.projects pr, p
    WHERE pr.user_id = p.id
    ORDER BY pr.created_at DESC
    LIMIT 120
  ), likes AS (
    SELECT count(*)::int AS n
    FROM public.votes v
    JOIN public.vote_sessions vs ON vs.id = v.vote_session_id
    JOIN p ON vs.creator_user_id = p.id
    WHERE v.choice::text IN ('yes','a','b')
  ), socials AS (
    SELECT sc.platform, sc.username, sc.profile_url
    FROM public.social_connections sc, p
    WHERE sc.user_id = p.id AND sc.is_public = true
    ORDER BY sc.platform
  )
  SELECT jsonb_build_object(
    'id', p.id,
    'handle', p.handle,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'created_at', p.created_at,
    'privacy', jsonb_build_object(
      'tattoos', priv.tattoos,
      'designs', priv.designs,
      'considering', priv.considering,
      'collections', priv.collections
    ),
    'likes', (SELECT n FROM likes),
    'socials', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM socials s), '[]'::jsonb),
    'tattoos', CASE WHEN priv.tattoos = 'public' THEN
      coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM items i WHERE i.shelf = 'tattoo'), '[]'::jsonb) ELSE '[]'::jsonb END,
    'designs', CASE WHEN priv.designs = 'public' THEN
      coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM items i WHERE i.shelf = 'design'), '[]'::jsonb) ELSE '[]'::jsonb END,
    'considering', CASE WHEN priv.considering = 'public' THEN
      coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM items i WHERE i.shelf = 'considering'), '[]'::jsonb) ELSE '[]'::jsonb END,
    'collections', CASE WHEN priv.collections = 'public' THEN
      coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM items i WHERE i.collection IS NOT NULL), '[]'::jsonb) ELSE '[]'::jsonb END
  )
  FROM p, priv;
$function$;