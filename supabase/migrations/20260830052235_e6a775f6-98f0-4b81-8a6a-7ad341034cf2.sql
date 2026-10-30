-- 1) profiles: remove broad full-row SELECT policies; cross-user reads go through public_profiles view
DROP POLICY IF EXISTS "Anon can read public handle fields" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
-- Owner-only access remains via "Users can view own profile" (auth.uid() = id).
-- public_profiles view (id, display_name, avatar_url, handle, bio, created_at) is the safe read surface:
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) studio_slots: remove public full-row exposure
DROP POLICY IF EXISTS "Slots are public" ON public.studio_slots;
REVOKE SELECT ON public.studio_slots FROM anon;

-- Signed-in users may read open slots, their own bookings, and slots of studios they own/admin
CREATE POLICY "Slot parties and studio can read"
ON public.studio_slots
FOR SELECT
TO authenticated
USING (
  status = 'open'
  OR booked_by = auth.uid()
  OR studio_id = auth.uid()
  OR public.is_studio_admin(studio_id, auth.uid())
);

-- Public availability surface: open slots only, no client data or scan paths
CREATE OR REPLACE VIEW public.public_slots AS
SELECT id, studio_id, member_id, deal_id, starts_at, duration_minutes, price_ore, note, status, requires_3d
FROM public.studio_slots
WHERE status = 'open';
GRANT SELECT ON public.public_slots TO anon, authenticated;

-- 3) SECURITY DEFINER functions: revoke EXECUTE from anon where public access is not needed
REVOKE EXECUTE ON FUNCTION public.accept_studio_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_artist_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_scan_scale(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_handle_available(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_studio_admin(uuid, uuid) FROM anon;