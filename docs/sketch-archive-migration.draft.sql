-- DRAFT — NOT APPLIED. Review before any production migration.
-- Additive only: existing artist_sketches / artist_project_sketch_versions stay untouched.

CREATE TABLE public.studio_sketch_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,              -- server-derived, never from client
  title text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  body_part text,
  head_revision integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text, source_id text,          -- import traceability
  UNIQUE (source, source_id)
);
CREATE TABLE public.studio_sketch_request_links (
  sketch_id uuid PRIMARY KEY REFERENCES public.studio_sketch_documents(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE
);
CREATE TABLE public.studio_sketch_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sketch_id uuid NOT NULL REFERENCES public.studio_sketch_documents(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  original_path text NOT NULL,          -- private bucket, .inkproj.json (layers, mmPerPixel, notes)
  preview_path text NOT NULL,           -- flat PNG, the only thing a customer can ever receive
  sha256 text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sketch_id, revision)
);
CREATE TABLE public.studio_sketch_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.studio_sketch_versions(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  token text UNIQUE,                    -- bound to this version only
  shared_by uuid NOT NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE public.studio_sketch_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.studio_sketch_shares(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.studio_sketch_versions(id),
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.studio_sketch_documents, public.studio_sketch_request_links TO authenticated;
GRANT SELECT, INSERT ON public.studio_sketch_versions, public.studio_sketch_shares, public.studio_sketch_comments TO authenticated;
GRANT ALL ON public.studio_sketch_documents, public.studio_sketch_request_links, public.studio_sketch_versions, public.studio_sketch_shares, public.studio_sketch_comments TO service_role;

ALTER TABLE public.studio_sketch_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_sketch_request_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_sketch_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_sketch_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_sketch_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_docs ON public.studio_sketch_documents FOR ALL TO authenticated
  USING (public.is_studio_staff(studio_id, auth.uid())) WITH CHECK (public.is_studio_staff(studio_id, auth.uid()));
CREATE POLICY staff_links ON public.studio_sketch_request_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_sketch_documents d JOIN public.artist_client_projects p ON p.id = request_id
                 WHERE d.id = sketch_id AND d.studio_id = p.artist_id AND public.is_studio_staff(d.studio_id, auth.uid())));
CREATE POLICY staff_versions ON public.studio_sketch_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_sketch_documents d WHERE d.id = sketch_id AND public.is_studio_staff(d.studio_id, auth.uid())));
-- No UPDATE/DELETE policy on versions: snapshots are immutable. Inserts go through a server function that bumps head_revision atomically.
CREATE POLICY share_read ON public.studio_sketch_shares FOR SELECT TO authenticated
  USING (revoked_at IS NULL AND recipient_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.artist_client_projects p WHERE p.id = request_id AND public.is_studio_staff(p.artist_id, auth.uid())));
CREATE POLICY comment_read ON public.studio_sketch_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_sketch_shares s WHERE s.id = share_id
      AND (s.recipient_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.artist_client_projects p WHERE p.id = s.request_id AND public.is_studio_staff(p.artist_id, auth.uid())))));
CREATE POLICY comment_write ON public.studio_sketch_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.studio_sketch_shares s WHERE s.id = share_id AND s.version_id = version_id
      AND s.revoked_at IS NULL AND s.recipient_user_id = auth.uid()));
-- Files: originals in private bucket "sketch-originals" readable only via server function after is_studio_staff;
-- previews signed by server only for staff or an active share row for that exact version.
