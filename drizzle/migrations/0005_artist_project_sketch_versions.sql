ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS final_sketch_version_id uuid;

CREATE TABLE public.artist_project_sketch_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  change_comment text NOT NULL,
  uploaded_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_project_sketch_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT artist_project_sketch_versions_comment_present CHECK (length(btrim(change_comment)) > 0),
  CONSTRAINT artist_project_sketch_versions_project_number_unique UNIQUE (project_id, version_number)
);
GRANT SELECT ON public.artist_project_sketch_versions TO authenticated;
GRANT ALL ON public.artist_project_sketch_versions TO service_role;
ALTER TABLE public.artist_project_sketch_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project parties read sketch versions"
  ON public.artist_project_sketch_versions FOR SELECT TO authenticated
  USING (public.is_artist_project_party(project_id, auth.uid()));
CREATE INDEX artist_project_sketch_versions_project_created_idx
  ON public.artist_project_sketch_versions (project_id, version_number);

ALTER TABLE public.artist_client_projects
  ADD CONSTRAINT artist_client_projects_final_sketch_version_fkey
  FOREIGN KEY (final_sketch_version_id) REFERENCES public.artist_project_sketch_versions(id) ON DELETE SET NULL;

CREATE TABLE public.artist_project_sketch_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.artist_project_sketch_versions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  coordinate_kind text NOT NULL,
  pos_x double precision NOT NULL,
  pos_y double precision NOT NULL,
  pos_z double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_project_sketch_annotation_body_present CHECK (length(btrim(body)) > 0),
  CONSTRAINT artist_project_sketch_annotation_kind CHECK (coordinate_kind IN ('image', 'model')),
  CONSTRAINT artist_project_sketch_annotation_image_coords CHECK (
    coordinate_kind <> 'image' OR (pos_x BETWEEN 0 AND 1 AND pos_y BETWEEN 0 AND 1 AND pos_z IS NULL)
  ),
  CONSTRAINT artist_project_sketch_annotation_model_coords CHECK (
    coordinate_kind <> 'model' OR pos_z IS NOT NULL
  )
);
GRANT SELECT, INSERT ON public.artist_project_sketch_annotations TO authenticated;
GRANT ALL ON public.artist_project_sketch_annotations TO service_role;
ALTER TABLE public.artist_project_sketch_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project parties read sketch annotations"
  ON public.artist_project_sketch_annotations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_project_sketch_versions v
    WHERE v.id = version_id AND public.is_artist_project_party(v.project_id, auth.uid())
  ));
CREATE POLICY "Project parties add sketch annotations"
  ON public.artist_project_sketch_annotations FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.artist_project_sketch_versions v
    WHERE v.id = version_id AND public.is_artist_project_party(v.project_id, auth.uid())
  ));
CREATE INDEX artist_project_sketch_annotations_version_created_idx
  ON public.artist_project_sketch_annotations (version_id, created_at);

CREATE OR REPLACE FUNCTION public.create_artist_project_sketch_version(
  _project_id uuid,
  _storage_path text,
  _file_name text,
  _mime_type text,
  _size_bytes bigint,
  _change_comment text
)
RETURNS public.artist_project_sketch_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _version public.artist_project_sketch_versions;
  _next_number integer;
BEGIN
  IF NOT public.is_artist_project_party(_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for this project';
  END IF;
  IF length(btrim(_change_comment)) = 0 THEN
    RAISE EXCEPTION 'A change comment is required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_project_id::text, 0));
  SELECT COALESCE(max(version_number), 0) + 1 INTO _next_number
  FROM public.artist_project_sketch_versions WHERE project_id = _project_id;
  INSERT INTO public.artist_project_sketch_versions (
    project_id, version_number, storage_path, file_name, mime_type, size_bytes, change_comment, uploaded_by
  ) VALUES (
    _project_id, _next_number, _storage_path, _file_name, _mime_type, _size_bytes, btrim(_change_comment), auth.uid()
  ) RETURNING * INTO _version;
  UPDATE public.artist_client_projects
  SET status = CASE WHEN status = 'open' THEN 'sketch_in_progress' ELSE status END,
      latest_activity_at = now()
  WHERE id = _project_id;
  RETURN _version;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_artist_project_sketch_version(uuid, text, text, text, bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_artist_project_sketch_version(_version_id uuid)
RETURNS public.artist_project_sketch_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _version public.artist_project_sketch_versions;
BEGIN
  SELECT * INTO _version FROM public.artist_project_sketch_versions WHERE id = _version_id;
  IF _version.id IS NULL OR NOT public.is_artist_project_party(_version.project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for this sketch version';
  END IF;
  UPDATE public.artist_project_sketch_versions
  SET approved_by = NULL, approved_at = NULL
  WHERE project_id = _version.project_id AND id <> _version_id AND approved_at IS NOT NULL;
  UPDATE public.artist_project_sketch_versions
  SET approved_by = auth.uid(), approved_at = now()
  WHERE id = _version_id RETURNING * INTO _version;
  UPDATE public.artist_client_projects
  SET final_sketch_version_id = _version_id, status = 'approved', latest_activity_at = now()
  WHERE id = _version.project_id;
  RETURN _version;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_artist_project_sketch_version(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_artist_project_from_sketch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'artist_project_sketch_annotations' THEN
    SELECT project_id INTO _project_id FROM public.artist_project_sketch_versions WHERE id = NEW.version_id;
  ELSE
    _project_id := NEW.project_id;
  END IF;
  UPDATE public.artist_client_projects SET latest_activity_at = now() WHERE id = _project_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER artist_project_sketch_versions_touch_activity
AFTER INSERT ON public.artist_project_sketch_versions
FOR EACH ROW EXECUTE FUNCTION public.touch_artist_project_from_sketch();
CREATE TRIGGER artist_project_sketch_annotations_touch_activity
AFTER INSERT ON public.artist_project_sketch_annotations
FOR EACH ROW EXECUTE FUNCTION public.touch_artist_project_from_sketch();