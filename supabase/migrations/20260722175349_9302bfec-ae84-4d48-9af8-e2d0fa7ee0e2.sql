
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_name text NOT NULL,
  studio_address text,
  studio_place_id text,
  studio_lat double precision,
  studio_lng double precision,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  preferred_date date NOT NULL,
  preferred_time text,
  duration_minutes int DEFAULT 60,
  body_area text,
  size_cm numeric,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own bookings read" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bookings insert" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bookings update" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bookings delete" ON public.bookings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX bookings_user_date_idx ON public.bookings(user_id, preferred_date DESC);
