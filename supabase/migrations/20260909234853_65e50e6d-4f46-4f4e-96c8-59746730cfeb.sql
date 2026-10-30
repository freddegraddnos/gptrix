-- 1. artist_profiles: restrict direct table reads to owner/admin
DROP POLICY IF EXISTS "Authenticated view approved artists" ON public.artist_profiles;
CREATE POLICY "Owner or admin can read artist profile"
ON public.artist_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. studio_slots: remove open-row full exposure
DROP POLICY IF EXISTS "Slot parties and studio can read" ON public.studio_slots;
CREATE POLICY "Slot parties and studio can read"
ON public.studio_slots FOR SELECT TO authenticated
USING (booked_by = auth.uid() OR studio_id = auth.uid() OR public.is_studio_admin(studio_id, auth.uid()));

-- 3. replace the security definer view with a safe function
DROP VIEW IF EXISTS public.public_slots;

CREATE OR REPLACE FUNCTION public.public_slots(_studio uuid)
RETURNS TABLE (
  id uuid,
  studio_id uuid,
  member_id uuid,
  deal_id uuid,
  starts_at timestamptz,
  duration_minutes integer,
  price_ore integer,
  note text,
  status text,
  requires_3d boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.studio_id, s.member_id, s.deal_id, s.starts_at,
         s.duration_minutes, s.price_ore, s.note, s.status, s.requires_3d
  FROM public.studio_slots s
  WHERE s.status = 'open' AND s.studio_id = _studio
  ORDER BY s.starts_at
$$;

GRANT EXECUTE ON FUNCTION public.public_slots(uuid) TO anon, authenticated;