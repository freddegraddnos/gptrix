ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.studio_agent_settings ADD COLUMN IF NOT EXISTS message_templates jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.agent_bookings ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

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
    'logo_url', a.logo_url,
    'theme', coalesce(a.theme, '{}'::jsonb),
    'agent_enabled', coalesce((SELECT s.enabled FROM public.studio_agent_settings s WHERE s.studio_id = a.user_id), false),
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