-- Presentation preferences only. Disabling a module never deletes records or
-- revokes access to existing bookings, requests, or financial obligations.
CREATE TABLE public.studio_module_preferences (
  studio_id uuid PRIMARY KEY REFERENCES public.artist_profiles(user_id) ON DELETE CASCADE,
  enabled text[] NOT NULL DEFAULT ARRAY['requests','designs','booking','payments','fortnox','models']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_module_preferences_known CHECK (enabled <@ ARRAY['requests','designs','booking','payments','fortnox','models']::text[])
);
ALTER TABLE public.studio_module_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.studio_module_preferences TO authenticated;
CREATE POLICY "Studio members read module choices" ON public.studio_module_preferences
  FOR SELECT TO authenticated USING (
    public.is_studio_admin(studio_id, auth.uid()) OR EXISTS (
      SELECT 1 FROM public.studio_members m WHERE m.studio_id = studio_module_preferences.studio_id
        AND m.user_id = auth.uid() AND m.status = 'active' AND m.role IN ('admin', 'artist')
    )
  );
CREATE POLICY "Studio admins create module choices" ON public.studio_module_preferences
  FOR INSERT TO authenticated WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));
CREATE POLICY "Studio admins update module choices" ON public.studio_module_preferences
  FOR UPDATE TO authenticated USING (public.is_studio_admin(studio_id, auth.uid()))
  WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));
