-- Roles (separate table, never on profiles)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.user_roles (user_id, role)
VALUES ('88ed7336-e73b-489a-9c62-7f275bfee3ce', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- SEO monitoring settings (single row)
CREATE TABLE IF NOT EXISTS public.seo_monitor_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  alert_email text,
  email_enabled boolean NOT NULL DEFAULT true,
  base_url text NOT NULL DEFAULT 'https://inkvision.app',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.seo_monitor_settings TO authenticated;
GRANT ALL ON public.seo_monitor_settings TO service_role;
ALTER TABLE public.seo_monitor_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage seo settings" ON public.seo_monitor_settings;
CREATE POLICY "Admins manage seo settings"
  ON public.seo_monitor_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.seo_monitor_settings (id, alert_email)
VALUES (true, '1891frs@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- SEO monitoring runs
CREATE TABLE IF NOT EXISTS public.seo_monitor_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  base_url text NOT NULL,
  source text NOT NULL DEFAULT 'cron',
  issue_count integer NOT NULL DEFAULT 0,
  new_issue_count integer NOT NULL DEFAULT 0,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  emailed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS seo_monitor_runs_ran_at_idx ON public.seo_monitor_runs (ran_at DESC);

GRANT SELECT ON public.seo_monitor_runs TO authenticated;
GRANT ALL ON public.seo_monitor_runs TO service_role;
ALTER TABLE public.seo_monitor_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read seo runs" ON public.seo_monitor_runs;
CREATE POLICY "Admins read seo runs"
  ON public.seo_monitor_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));