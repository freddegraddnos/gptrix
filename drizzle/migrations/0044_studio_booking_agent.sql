CREATE TABLE public.studio_agent_settings (
  studio_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  booking_mode text NOT NULL DEFAULT 'approve' CHECK (booking_mode IN ('direct','approve')),
  pricing_mode text NOT NULL DEFAULT 'consultation' CHECK (pricing_mode IN ('hourly','size','service','consultation')),
  hourly_rate_ore integer,
  size_tiers jsonb NOT NULL DEFAULT '[{"label":"S","max_cm":5,"price_ore":100000,"minutes":60},{"label":"M","max_cm":10,"price_ore":200000,"minutes":120},{"label":"L","max_cm":20,"price_ore":400000,"minutes":240},{"label":"XL","max_cm":40,"price_ore":800000,"minutes":480}]',
  min_minutes integer NOT NULL DEFAULT 60,
  buffer_minutes integer NOT NULL DEFAULT 0,
  horizon_days integer NOT NULL DEFAULT 60,
  deposit_ore integer,
  knowledge text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.studio_agent_settings TO authenticated;
GRANT ALL ON public.studio_agent_settings TO service_role;
ALTER TABLE public.studio_agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio staff read agent settings" ON public.studio_agent_settings FOR SELECT TO authenticated USING (public.is_studio_staff(studio_id, auth.uid()));
CREATE POLICY "Studio admins insert agent settings" ON public.studio_agent_settings FOR INSERT TO authenticated WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));
CREATE POLICY "Studio admins update agent settings" ON public.studio_agent_settings FOR UPDATE TO authenticated USING (public.is_studio_admin(studio_id, auth.uid())) WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));

CREATE TABLE public.agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  session_key text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, session_key)
);
GRANT SELECT ON public.agent_threads TO authenticated;
GRANT ALL ON public.agent_threads TO service_role;
ALTER TABLE public.agent_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio staff read agent threads" ON public.agent_threads FOR SELECT TO authenticated USING (public.is_studio_staff(studio_id, auth.uid()));

CREATE TABLE public.agent_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  thread_id uuid REFERENCES public.agent_threads(id) ON DELETE SET NULL,
  slot_id uuid,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  idea text,
  motif_url text,
  placement text,
  size_cm numeric,
  quoted_price_ore integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.agent_bookings TO authenticated;
GRANT ALL ON public.agent_bookings TO service_role;
ALTER TABLE public.agent_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio staff read agent bookings" ON public.agent_bookings FOR SELECT TO authenticated USING (public.is_studio_staff(studio_id, auth.uid()));
CREATE INDEX agent_bookings_studio_idx ON public.agent_bookings (studio_id, starts_at);