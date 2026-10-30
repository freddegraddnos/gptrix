CREATE OR REPLACE FUNCTION public.find_couple_by_code(_code text)
RETURNS TABLE (id uuid, name text, member_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, (SELECT count(*)::int FROM public.couple_members m WHERE m.couple_id = c.id)
  FROM public.couples c
  WHERE upper(c.invite_code) = upper(_code)
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.find_couple_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_couple_by_code(text) TO authenticated, service_role;