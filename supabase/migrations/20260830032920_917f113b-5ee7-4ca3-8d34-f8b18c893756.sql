-- Feed post details
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS price_ore integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS try_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_post_try(_post_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.posts SET try_count = try_count + 1 WHERE id = _post_id
  RETURNING try_count;
$$;
REVOKE ALL ON FUNCTION public.increment_post_try(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_try(uuid) TO authenticated;

-- Opening hours on the studio profile
ALTER TABLE public.artist_profiles ADD COLUMN IF NOT EXISTS opening_hours text;

-- Studio team members with roles
CREATE TABLE IF NOT EXISTS public.studio_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'artist' CHECK (role IN ('admin','artist')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
  invite_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  artist_member_id uuid REFERENCES public.studio_artists(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_members TO authenticated;
GRANT ALL ON public.studio_members TO service_role;
ALTER TABLE public.studio_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_studio_admin(_studio uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user IS NOT NULL AND (
    _studio = _user
    OR EXISTS (
      SELECT 1 FROM public.studio_members m
      WHERE m.studio_id = _studio AND m.user_id = _user
        AND m.role = 'admin' AND m.status = 'active'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.is_studio_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_studio_admin(uuid, uuid) TO authenticated;

CREATE POLICY "Studio owners and admins read members"
  ON public.studio_members FOR SELECT TO authenticated
  USING (public.is_studio_admin(studio_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Studio owners and admins add members"
  ON public.studio_members FOR INSERT TO authenticated
  WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));
CREATE POLICY "Studio owners and admins update members"
  ON public.studio_members FOR UPDATE TO authenticated
  USING (public.is_studio_admin(studio_id, auth.uid()))
  WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));
CREATE POLICY "Studio owners and admins remove members"
  ON public.studio_members FOR DELETE TO authenticated
  USING (public.is_studio_admin(studio_id, auth.uid()));

CREATE TRIGGER studio_members_updated_at BEFORE UPDATE ON public.studio_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.accept_studio_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.studio_members;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_required');
  END IF;
  UPDATE public.studio_members
     SET user_id = auth.uid(), status = 'active'
   WHERE invite_token = _token AND status = 'invited'
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'studio_id', _row.studio_id, 'role', _row.role);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_studio_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_studio_invite(text) TO authenticated;

-- Weekly availability per studio / artist
CREATE TABLE IF NOT EXISTS public.studio_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.studio_artists(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 60,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_availability TO authenticated;
GRANT ALL ON public.studio_availability TO service_role;
ALTER TABLE public.studio_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability is public" ON public.studio_availability FOR SELECT USING (true);
CREATE POLICY "Studio manages availability insert" ON public.studio_availability
  FOR INSERT TO authenticated WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));
CREATE POLICY "Studio manages availability update" ON public.studio_availability
  FOR UPDATE TO authenticated USING (public.is_studio_admin(studio_id, auth.uid()))
  WITH CHECK (public.is_studio_admin(studio_id, auth.uid()));
CREATE POLICY "Studio manages availability delete" ON public.studio_availability
  FOR DELETE TO authenticated USING (public.is_studio_admin(studio_id, auth.uid()));

CREATE TRIGGER studio_availability_updated_at BEFORE UPDATE ON public.studio_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Booking links and cancellation handling
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.studio_slots(id) ON DELETE SET NULL;
ALTER TABLE public.studio_slots ADD COLUMN IF NOT EXISTS client_note text;

CREATE POLICY "Clients release their own slot" ON public.studio_slots
  FOR UPDATE TO authenticated
  USING (booked_by = auth.uid())
  WITH CHECK (booked_by = auth.uid() OR booked_by IS NULL);