CREATE TABLE public.artist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_name text NOT NULL,
  address text,
  website text,
  contact_email text NOT NULL,
  city text,
  bio text,
  instagram text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_profiles TO authenticated;
GRANT ALL ON public.artist_profiles TO service_role;
ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists manage own profile" ON public.artist_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated view approved artists" ON public.artist_profiles
  FOR SELECT TO authenticated USING (status = 'approved');

CREATE TRIGGER artist_profiles_updated_at BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.artist_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'custom',
  title text NOT NULL,
  description text,
  price_ore integer NOT NULL DEFAULT 0,
  duration_minutes integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_services TO authenticated;
GRANT ALL ON public.artist_services TO service_role;
ALTER TABLE public.artist_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists manage own services" ON public.artist_services
  FOR ALL TO authenticated USING (auth.uid() = artist_id) WITH CHECK (auth.uid() = artist_id);
CREATE POLICY "Authenticated view active services" ON public.artist_services
  FOR SELECT TO authenticated USING (active = true);

CREATE TRIGGER artist_services_updated_at BEFORE UPDATE ON public.artist_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX artist_services_artist_idx ON public.artist_services(artist_id);