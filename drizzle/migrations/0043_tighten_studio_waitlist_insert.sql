DROP POLICY IF EXISTS "Anyone can join the studio waitlist" ON public.studio_waitlist;
CREATE POLICY "Anyone can join the studio waitlist with valid details"
ON public.studio_waitlist FOR INSERT TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND char_length(email) BETWEEN 5 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (city IS NULL OR char_length(city) <= 120)
);