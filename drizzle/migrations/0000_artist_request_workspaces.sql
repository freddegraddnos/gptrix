CREATE OR REPLACE FUNCTION public.is_studio_staff(_studio uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user IS NOT NULL AND (
    _studio = _user OR EXISTS (
      SELECT 1 FROM public.studio_members m
      WHERE m.studio_id = _studio
        AND m.user_id = _user
        AND m.status = 'active'
        AND m.role IN ('admin', 'artist')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_studio_staff(uuid, uuid) TO authenticated;

ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS placement text,
  ADD COLUMN IF NOT EXISTS size_cm numeric,
  ADD COLUMN IF NOT EXISTS color_mode text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS assigned_artist_id uuid REFERENCES public.studio_artists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_amount_ore integer,
  ADD COLUMN IF NOT EXISTS quote_message text,
  ADD COLUMN IF NOT EXISTS quote_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS latest_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scan_id uuid REFERENCES public.body_scans(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS artist_project_id uuid REFERENCES public.artist_client_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS artist_client_projects_artist_activity_idx
  ON public.artist_client_projects (artist_id, latest_activity_at DESC);
CREATE INDEX IF NOT EXISTS artist_client_projects_assigned_artist_idx
  ON public.artist_client_projects (assigned_artist_id);
CREATE INDEX IF NOT EXISTS bookings_artist_project_idx
  ON public.bookings (artist_project_id);

CREATE TABLE public.artist_project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'reference',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_project_attachments TO authenticated;
GRANT ALL ON public.artist_project_attachments TO service_role;
ALTER TABLE public.artist_project_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project parties read attachments"
  ON public.artist_project_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = project_id
      AND (p.client_user_id = auth.uid() OR public.is_studio_staff(p.artist_id, auth.uid()))
  ));
CREATE POLICY "Project parties upload attachments"
  ON public.artist_project_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = project_id
      AND (p.client_user_id = auth.uid() OR public.is_studio_staff(p.artist_id, auth.uid()))
  ));
CREATE POLICY "Uploaders and studio delete attachments"
  ON public.artist_project_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = project_id AND public.is_studio_staff(p.artist_id, auth.uid())
  ));

CREATE TABLE public.artist_project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  attachment_id uuid REFERENCES public.artist_project_attachments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.artist_project_messages TO authenticated;
GRANT ALL ON public.artist_project_messages TO service_role;
ALTER TABLE public.artist_project_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project parties read messages"
  ON public.artist_project_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = project_id
      AND (p.client_user_id = auth.uid() OR public.is_studio_staff(p.artist_id, auth.uid()))
  ));
CREATE POLICY "Project parties send messages"
  ON public.artist_project_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = project_id
      AND (p.client_user_id = auth.uid() OR public.is_studio_staff(p.artist_id, auth.uid()))
  ));
CREATE INDEX artist_project_messages_project_created_idx
  ON public.artist_project_messages (project_id, created_at);

CREATE TABLE public.artist_project_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_project_notes TO authenticated;
GRANT ALL ON public.artist_project_notes TO service_role;
ALTER TABLE public.artist_project_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio staff manage internal notes"
  ON public.artist_project_notes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = project_id AND public.is_studio_staff(p.artist_id, auth.uid())
  ))
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = project_id AND public.is_studio_staff(p.artist_id, auth.uid())
  ));

CREATE POLICY "Studio staff read client projects"
  ON public.artist_client_projects FOR SELECT TO authenticated
  USING (public.is_studio_staff(artist_id, auth.uid()));
CREATE POLICY "Studio staff update client projects"
  ON public.artist_client_projects FOR UPDATE TO authenticated
  USING (public.is_studio_staff(artist_id, auth.uid()))
  WITH CHECK (public.is_studio_staff(artist_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.is_artist_project_party(_project uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artist_client_projects p
    WHERE p.id = _project
      AND (p.client_user_id = _user OR public.is_studio_staff(p.artist_id, _user))
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_artist_project_party(uuid, uuid) TO authenticated;

CREATE POLICY "Project parties read project attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'project'
    AND public.is_artist_project_party(((storage.foldername(name))[2])::uuid, auth.uid())
  );
CREATE POLICY "Project parties upload project attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'project'
    AND public.is_artist_project_party(((storage.foldername(name))[2])::uuid, auth.uid())
  );
CREATE POLICY "Project uploaders delete project attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'project'
    AND owner = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.touch_artist_project_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.artist_client_projects
  SET latest_activity_at = now()
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER artist_project_messages_touch_activity
AFTER INSERT ON public.artist_project_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_artist_project_activity();
CREATE TRIGGER artist_project_attachments_touch_activity
AFTER INSERT ON public.artist_project_attachments
FOR EACH ROW EXECUTE FUNCTION public.touch_artist_project_activity();
CREATE TRIGGER artist_project_notes_touch_activity
AFTER INSERT ON public.artist_project_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_artist_project_activity();
CREATE TRIGGER artist_project_notes_updated_at
BEFORE UPDATE ON public.artist_project_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_artist_project_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.artist_project_id IS NOT NULL AND NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.artist_client_projects
    SET status = 'booked', latest_activity_at = now()
    WHERE id = NEW.artist_project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_sync_artist_project_status
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_artist_project_booking_status();