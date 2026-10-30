ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_set boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET username_set = true WHERE handle IS NOT NULL AND username_set = false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_lower_key ON public.profiles (lower(handle)) WHERE handle IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_handle_available(_handle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _handle ~ '^[A-Za-z0-9_]{3,20}$'
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE lower(p.handle) = lower(_handle)
         AND p.id IS DISTINCT FROM auth.uid()
     );
$$;

GRANT EXECUTE ON FUNCTION public.is_handle_available(text) TO anon, authenticated;