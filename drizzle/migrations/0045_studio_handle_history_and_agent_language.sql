ALTER TABLE public.studio_agent_settings ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'sv' CHECK (language IN ('sv','en'));
ALTER TABLE public.agent_bookings ADD COLUMN IF NOT EXISTS customer_lang text CHECK (customer_lang IN ('sv','en'));

CREATE TABLE public.studio_handle_history (
  old_handle text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_handle_history TO authenticated;
GRANT ALL ON public.studio_handle_history TO service_role;
ALTER TABLE public.studio_handle_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own handle history" ON public.studio_handle_history FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.resolve_studio_handle(_handle text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ap.handle FROM public.studio_handle_history h
  JOIN public.artist_profiles ap ON ap.user_id = h.user_id
  WHERE h.old_handle = lower(_handle) AND ap.handle IS NOT NULL
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.resolve_studio_handle(text) TO anon, authenticated;