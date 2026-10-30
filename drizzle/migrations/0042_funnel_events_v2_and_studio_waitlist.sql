ALTER TABLE public.analytics_events DROP CONSTRAINT analytics_events_event_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_event_check CHECK (event = ANY (ARRAY[
 'ar_started','photo_uploaded','design_saved','shared','studio_clicked','camera_prompt_shown','camera_granted','camera_denied','tryon_started','tryon_completed','booking_started','studio_contact_clicked','booking_completed',
 'ar_opened','design_selected','share_clicked','studios_viewed','for_studios_cta_clicked','studio_request_submitted','signup_started','signup_completed'
]));

CREATE TABLE public.studio_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.studio_waitlist TO anon, authenticated;
GRANT SELECT ON public.studio_waitlist TO authenticated;
GRANT ALL ON public.studio_waitlist TO service_role;
ALTER TABLE public.studio_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join the studio waitlist" ON public.studio_waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can read the studio waitlist" ON public.studio_waitlist FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));