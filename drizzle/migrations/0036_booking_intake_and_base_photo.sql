ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS base_photo_url text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS intake_answers jsonb;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS booking_greeting text;
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS booking_questions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS base_photo_url text;

CREATE OR REPLACE FUNCTION public.studio_booking_form(_studio uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('greeting', booking_greeting, 'questions', COALESCE(booking_questions, '[]'::jsonb))
  FROM public.artist_profiles WHERE user_id = _studio
$$;
GRANT EXECUTE ON FUNCTION public.studio_booking_form(uuid) TO anon, authenticated;