-- Per-studio Instagram connection (service-role only; tokens are encrypted).
CREATE TABLE public.studio_instagram_links (
  studio_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  username text,
  token_ciphertext text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.studio_instagram_links TO service_role;
ALTER TABLE public.studio_instagram_links ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.studio_instagram_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.studio_instagram_status(_studio uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_studio_staff(_studio, auth.uid()) THEN jsonb_build_object('linked', false, 'allowed', false)
    ELSE COALESCE((
      SELECT jsonb_build_object('linked', true, 'allowed', true, 'username', l.username, 'expires_at', l.token_expires_at)
      FROM public.studio_instagram_links l WHERE l.studio_id = _studio
    ), jsonb_build_object('linked', false, 'allowed', true))
  END;
$$;

-- Instagram conversations mirrored into InkVision.
CREATE TABLE public.instagram_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_thread_id text NOT NULL,
  participant_id text NOT NULL,
  participant_name text,
  participant_username text,
  participant_avatar text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_inbound_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.artist_client_projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, ig_thread_id)
);
GRANT SELECT, UPDATE ON public.instagram_threads TO authenticated;
GRANT ALL ON public.instagram_threads TO service_role;
ALTER TABLE public.instagram_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio staff read threads" ON public.instagram_threads
  FOR SELECT TO authenticated USING (public.is_studio_staff(studio_id, auth.uid()));
CREATE POLICY "Studio staff update threads" ON public.instagram_threads
  FOR UPDATE TO authenticated USING (public.is_studio_staff(studio_id, auth.uid()))
  WITH CHECK (public.is_studio_staff(studio_id, auth.uid()));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.instagram_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX instagram_threads_studio_activity_idx ON public.instagram_threads (studio_id, last_message_at DESC);

CREATE OR REPLACE FUNCTION public.is_instagram_thread_staff(_thread uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.instagram_threads t
    WHERE t.id = _thread AND public.is_studio_staff(t.studio_id, _user)
  );
$$;

CREATE TABLE public.instagram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.instagram_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  body text,
  attachment_url text,
  ig_message_id text UNIQUE,
  ai_time jsonb,
  ai_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.instagram_messages TO authenticated;
GRANT ALL ON public.instagram_messages TO service_role;
ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio staff read instagram messages" ON public.instagram_messages
  FOR SELECT TO authenticated USING (public.is_instagram_thread_staff(thread_id, auth.uid()));
CREATE POLICY "Studio staff update instagram messages" ON public.instagram_messages
  FOR UPDATE TO authenticated USING (public.is_instagram_thread_staff(thread_id, auth.uid()))
  WITH CHECK (public.is_instagram_thread_staff(thread_id, auth.uid()));
CREATE INDEX instagram_messages_thread_idx ON public.instagram_messages (thread_id, created_at);

-- AI time suggestion cache for InkVision project messages.
ALTER TABLE public.artist_project_messages ADD COLUMN IF NOT EXISTS ai_time jsonb;
ALTER TABLE public.artist_project_messages ADD COLUMN IF NOT EXISTS ai_checked_at timestamptz;

-- Public, revocable link to a project's latest sketch.
ALTER TABLE public.artist_client_projects ADD COLUMN IF NOT EXISTS sketch_share_token text;
ALTER TABLE public.artist_client_projects ADD COLUMN IF NOT EXISTS sketch_share_enabled boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS artist_client_projects_sketch_share_token_idx
  ON public.artist_client_projects (sketch_share_token) WHERE sketch_share_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sketch_share_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proj record;
  ver record;
  studio_name text;
BEGIN
  SELECT p.id, p.title, p.artist_id, p.final_sketch_version_id
    INTO proj
    FROM public.artist_client_projects p
   WHERE p.sketch_share_token = _token AND p.sketch_share_enabled = true;
  IF proj IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT v.id, v.version_number, v.storage_path, v.file_name, v.mime_type, v.change_comment, v.created_at, v.approved_at
    INTO ver
    FROM public.artist_project_sketch_versions v
   WHERE v.project_id = proj.id
   ORDER BY (v.id = proj.final_sketch_version_id) DESC, v.version_number DESC
   LIMIT 1;

  SELECT a.studio_name INTO studio_name FROM public.artist_profiles a WHERE a.user_id = proj.artist_id;

  RETURN jsonb_build_object(
    'found', true,
    'project_title', proj.title,
    'studio_name', studio_name,
    'version', CASE WHEN ver IS NULL THEN NULL ELSE jsonb_build_object(
      'id', ver.id,
      'version_number', ver.version_number,
      'storage_path', ver.storage_path,
      'file_name', ver.file_name,
      'mime_type', ver.mime_type,
      'change_comment', ver.change_comment,
      'created_at', ver.created_at,
      'approved', ver.approved_at IS NOT NULL
    ) END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.sketch_share_by_token(text) TO anon, authenticated;
