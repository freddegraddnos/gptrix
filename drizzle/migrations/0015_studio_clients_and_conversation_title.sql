ALTER TABLE public.artist_client_projects ADD COLUMN IF NOT EXISTS conversation_title text;

CREATE TABLE public.studio_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  client_key text NOT NULL,
  client_user_id uuid,
  display_name text,
  email text,
  phone text,
  note text,
  state text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_clients_state_check CHECK (state IN ('active','hidden','ended')),
  CONSTRAINT studio_clients_unique UNIQUE (studio_id, client_key)
);

CREATE INDEX studio_clients_studio_idx ON public.studio_clients (studio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_clients TO authenticated;
GRANT ALL ON public.studio_clients TO service_role;

ALTER TABLE public.studio_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio staff read clients" ON public.studio_clients
  FOR SELECT TO authenticated
  USING (public.is_studio_staff(studio_id, auth.uid()));

CREATE POLICY "studio staff insert clients" ON public.studio_clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_studio_staff(studio_id, auth.uid()));

CREATE POLICY "studio staff update clients" ON public.studio_clients
  FOR UPDATE TO authenticated
  USING (public.is_studio_staff(studio_id, auth.uid()))
  WITH CHECK (public.is_studio_staff(studio_id, auth.uid()));

CREATE POLICY "studio staff delete clients" ON public.studio_clients
  FOR DELETE TO authenticated
  USING (public.is_studio_staff(studio_id, auth.uid()));

CREATE TRIGGER studio_clients_set_updated_at
  BEFORE UPDATE ON public.studio_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();