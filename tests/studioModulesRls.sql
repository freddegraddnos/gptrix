-- Run only in a disposable empty PostgreSQL database as a superuser:
-- psql -X -v ON_ERROR_STOP=1 -f tests/studioModulesRls.sql <test-database>
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.artist_profiles (user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.studio_members (studio_id uuid, user_id uuid, status text, role text);
GRANT SELECT ON public.studio_members TO authenticated;
CREATE FUNCTION public.is_studio_admin(_studio uuid, _user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _studio = _user OR EXISTS (SELECT 1 FROM public.studio_members
    WHERE studio_id=_studio AND user_id=_user AND status='active' AND role='admin');
$$;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.artist_profiles VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.studio_members VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','active','admin'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','active','artist'),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','revoked','artist');
\ir ../drizzle/migrations/0057_studio_modules.sql
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
INSERT INTO public.studio_module_preferences(studio_id,enabled)
 VALUES ('00000000-0000-0000-0000-000000000001',ARRAY['booking']);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
DO $$ BEGIN
  UPDATE public.studio_module_preferences SET enabled=ARRAY['designs'];
  IF NOT FOUND THEN RAISE EXCEPTION 'admin could not update'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.studio_module_preferences) <> 1 THEN RAISE EXCEPTION 'artist cannot read'; END IF;
  UPDATE public.studio_module_preferences SET enabled=ARRAY['booking'];
  IF FOUND THEN RAISE EXCEPTION 'artist could update'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.studio_module_preferences) <> 0 THEN RAISE EXCEPTION 'revoked user can read'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.studio_module_preferences) <> 0 THEN RAISE EXCEPTION 'outsider can read'; END IF;
  UPDATE public.studio_module_preferences SET enabled=ARRAY['booking'];
  IF FOUND THEN RAISE EXCEPTION 'outsider could update'; END IF;
END $$;
ROLLBACK;
