-- Every studio needs a public handle: requests, public profiles and booking
-- links are all routed by it. Generate one from the studio name when missing.
CREATE OR REPLACE FUNCTION public.generate_studio_handle(_name text, _user uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(_name, ''), '[^a-zA-Z0-9]+', '', 'g'));
  IF base IS NULL OR length(base) < 3 THEN
    base := 'studio' || substr(replace(_user::text, '-', ''), 1, 6);
  END IF;
  base := substr(base, 1, 24);
  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.artist_profiles
    WHERE lower(handle) = candidate AND user_id <> _user
  ) LOOP
    n := n + 1;
    candidate := substr(base, 1, 24) || n::text;
  END LOOP;
  RETURN candidate;
END;
$$;

UPDATE public.artist_profiles
SET handle = public.generate_studio_handle(studio_name, user_id)
WHERE handle IS NULL OR length(trim(handle)) = 0;

CREATE OR REPLACE FUNCTION public.set_studio_handle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.handle IS NULL OR length(trim(NEW.handle)) = 0 THEN
    NEW.handle := public.generate_studio_handle(NEW.studio_name, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS artist_profiles_set_handle ON public.artist_profiles;
CREATE TRIGGER artist_profiles_set_handle
BEFORE INSERT OR UPDATE ON public.artist_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_studio_handle();