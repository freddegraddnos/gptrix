-- Artist handle + review fields
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS artist_profiles_handle_key
  ON public.artist_profiles (lower(handle)) WHERE handle IS NOT NULL;

-- Client projects owned by an artist
CREATE TABLE IF NOT EXISTS public.artist_client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_handle text,
  client_name text,
  title text NOT NULL,
  notes text,
  base_photo_url text,
  motif_url text,
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  before_url text,
  after_url text,
  preview_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  invite_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  publish_approved boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS artist_client_projects_preview_token_key
  ON public.artist_client_projects (preview_token);
CREATE UNIQUE INDEX IF NOT EXISTS artist_client_projects_invite_token_key
  ON public.artist_client_projects (invite_token);
CREATE INDEX IF NOT EXISTS artist_client_projects_artist_idx
  ON public.artist_client_projects (artist_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_client_projects TO authenticated;
GRANT ALL ON public.artist_client_projects TO service_role;
ALTER TABLE public.artist_client_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists manage own client projects"
ON public.artist_client_projects FOR ALL TO authenticated
USING (auth.uid() = artist_id) WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Clients can view their projects"
ON public.artist_client_projects FOR SELECT TO authenticated
USING (auth.uid() = client_user_id);

CREATE POLICY "Clients can approve publishing"
ON public.artist_client_projects FOR UPDATE TO authenticated
USING (auth.uid() = client_user_id) WITH CHECK (auth.uid() = client_user_id);

CREATE TRIGGER artist_client_projects_updated_at
BEFORE UPDATE ON public.artist_client_projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comments on a shared preview link
CREATE TABLE IF NOT EXISTS public.artist_project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artist_project_comments_project_idx
  ON public.artist_project_comments (project_id, created_at);

GRANT SELECT, INSERT ON public.artist_project_comments TO authenticated;
GRANT ALL ON public.artist_project_comments TO service_role;
ALTER TABLE public.artist_project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project parties read comments"
ON public.artist_project_comments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.artist_client_projects p
  WHERE p.id = project_id
    AND (p.artist_id = auth.uid() OR p.client_user_id = auth.uid())
));

CREATE POLICY "Project parties write comments"
ON public.artist_project_comments FOR INSERT TO authenticated
WITH CHECK (author_user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.artist_client_projects p
  WHERE p.id = project_id
    AND (p.artist_id = auth.uid() OR p.client_user_id = auth.uid())
));

-- Public preview by token (no auth)
CREATE OR REPLACE FUNCTION public.artist_preview_by_token(_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'notes', p.notes,
    'client_name', p.client_name,
    'before_url', p.before_url,
    'after_url', p.after_url,
    'base_photo_url', p.base_photo_url,
    'created_at', p.created_at,
    'artist', jsonb_build_object(
      'studio_name', ap.studio_name,
      'city', ap.city,
      'handle', ap.handle,
      'avatar_url', ap.avatar_url
    ),
    'comments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'author_name', c.author_name,
        'body', c.body, 'created_at', c.created_at
      ) ORDER BY c.created_at)
      FROM public.artist_project_comments c WHERE c.project_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.artist_client_projects p
  LEFT JOIN public.artist_profiles ap ON ap.user_id = p.artist_id
  WHERE p.preview_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.add_artist_preview_comment(_token text, _name text, _body text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _pid uuid;
BEGIN
  IF _body IS NULL OR length(btrim(_body)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty');
  END IF;
  SELECT id INTO _pid FROM public.artist_client_projects WHERE preview_token = _token;
  IF _pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  INSERT INTO public.artist_project_comments (project_id, author_user_id, author_name, body)
  VALUES (_pid, auth.uid(), nullif(btrim(coalesce(_name, '')), ''), left(btrim(_body), 2000));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Client claims an invite link
CREATE OR REPLACE FUNCTION public.claim_artist_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _row public.artist_client_projects;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;
  UPDATE public.artist_client_projects
     SET client_user_id = auth.uid()
   WHERE invite_token = _token AND client_user_id IS NULL
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN
    SELECT * INTO _row FROM public.artist_client_projects WHERE invite_token = _token;
  END IF;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'preview_token', _row.preview_token);
END;
$$;

-- Search users by handle (for linking a client to a project)
CREATE OR REPLACE FUNCTION public.search_user_handles(_q text)
RETURNS TABLE(id uuid, handle text, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pr.id, pr.handle, pr.display_name, pr.avatar_url
  FROM public.profiles pr
  WHERE auth.uid() IS NOT NULL
    AND pr.handle IS NOT NULL
    AND length(btrim(coalesce(_q, ''))) >= 2
    AND pr.handle ILIKE '%' || btrim(_q) || '%'
  ORDER BY pr.handle
  LIMIT 10;
$$;

-- Public artist profile page
CREATE OR REPLACE FUNCTION public.public_artist_page(_handle text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
$$;