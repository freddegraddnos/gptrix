ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS headline text;

CREATE TABLE public.studio_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  bio text,
  avatar_url text,
  instagram text,
  styles text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_artists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_artists TO authenticated;
GRANT ALL ON public.studio_artists TO service_role;
ALTER TABLE public.studio_artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio artists are public" ON public.studio_artists FOR SELECT USING (true);
CREATE POLICY "Studio manages its artists" ON public.studio_artists FOR ALL TO authenticated
  USING (auth.uid() = studio_id) WITH CHECK (auth.uid() = studio_id);
CREATE TRIGGER studio_artists_updated_at BEFORE UPDATE ON public.studio_artists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.studio_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.studio_artists(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  caption text,
  style text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_gallery TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_gallery TO authenticated;
GRANT ALL ON public.studio_gallery TO service_role;
ALTER TABLE public.studio_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio gallery is public" ON public.studio_gallery FOR SELECT USING (true);
CREATE POLICY "Studio manages its gallery" ON public.studio_gallery FOR ALL TO authenticated
  USING (auth.uid() = studio_id) WITH CHECK (auth.uid() = studio_id);
CREATE TRIGGER studio_gallery_updated_at BEFORE UPDATE ON public.studio_gallery
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.studio_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.studio_artists(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  discount_percent integer,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_deals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_deals TO authenticated;
GRANT ALL ON public.studio_deals TO service_role;
ALTER TABLE public.studio_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active deals are public" ON public.studio_deals FOR SELECT USING (active = true);
CREATE POLICY "Studio manages its deals" ON public.studio_deals FOR ALL TO authenticated
  USING (auth.uid() = studio_id) WITH CHECK (auth.uid() = studio_id);
CREATE TRIGGER studio_deals_updated_at BEFORE UPDATE ON public.studio_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.studio_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.studio_artists(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.studio_deals(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  price_ore integer,
  note text,
  status text NOT NULL DEFAULT 'open',
  booked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_slots TO authenticated;
GRANT ALL ON public.studio_slots TO service_role;
ALTER TABLE public.studio_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Slots are public" ON public.studio_slots FOR SELECT USING (true);
CREATE POLICY "Studio manages its slots" ON public.studio_slots FOR ALL TO authenticated
  USING (auth.uid() = studio_id) WITH CHECK (auth.uid() = studio_id);
CREATE POLICY "Users can claim an open slot" ON public.studio_slots FOR UPDATE TO authenticated
  USING (status = 'open') WITH CHECK (booked_by = auth.uid() AND status = 'booked');
CREATE TRIGGER studio_slots_updated_at BEFORE UPDATE ON public.studio_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX studio_artists_studio_idx ON public.studio_artists(studio_id, sort_order);
CREATE INDEX studio_gallery_studio_idx ON public.studio_gallery(studio_id, created_at DESC);
CREATE INDEX studio_deals_studio_idx ON public.studio_deals(studio_id, created_at DESC);
CREATE INDEX studio_slots_studio_idx ON public.studio_slots(studio_id, starts_at);