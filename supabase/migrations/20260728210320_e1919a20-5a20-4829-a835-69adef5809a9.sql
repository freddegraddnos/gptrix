
-- 1) Lock down profiles: drop public SELECT, keep authenticated + own
DROP POLICY IF EXISTS "Public profiles readable by anyone" ON public.profiles;

CREATE POLICY "Authenticated can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.profiles FROM anon;

-- Public-safe view for shareable profile pages (no referral_code, no bonus_until)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, display_name, avatar_url, handle, bio, created_at
FROM public.profiles
WHERE handle IS NOT NULL;

-- The view needs its own anon-visible policy on the base table for the columns it exposes
CREATE POLICY "Anon can read public handle fields"
  ON public.profiles FOR SELECT
  TO anon
  USING (handle IS NOT NULL);

-- Restrict what anon can select on the base table to safe columns only
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, display_name, avatar_url, handle, bio, created_at) ON public.profiles TO anon;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Tighten "always true" INSERT policy on conversations
DROP POLICY IF EXISTS "Authenticated create conversations" ON public.conversations;
CREATE POLICY "Authenticated create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) Lock down SECURITY DEFINER functions
-- Trigger functions: no direct callers needed
REVOKE ALL ON FUNCTION public.notify_on_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Helper used in RLS policies: only needs to run inside policy evaluation, not as RPC
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Signed-in RPCs: authenticated only, not anon
REVOKE ALL ON FUNCTION public.ensure_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;
