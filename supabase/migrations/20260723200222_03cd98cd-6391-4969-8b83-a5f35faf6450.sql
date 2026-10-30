
-- Extend profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_until timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);

-- Make sure profiles are publicly readable for /u/{handle}
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Public profiles readable by anyone') THEN
    CREATE POLICY "Public profiles readable by anyone" ON public.profiles FOR SELECT USING (true);
  END IF;
END $$;
GRANT SELECT ON public.profiles TO anon;

-- Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uses_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_user ON public.referrals(user_id);
GRANT SELECT ON public.referrals TO anon, authenticated;
GRANT INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referrals' AND policyname='Referral codes are public') THEN
    CREATE POLICY "Referral codes are public" ON public.referrals FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referrals' AND policyname='Users create own referrals') THEN
    CREATE POLICY "Users create own referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referrals' AND policyname='Users update own referrals') THEN
    CREATE POLICY "Users update own referrals" ON public.referrals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Redemptions
CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.referrals(code) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_days int NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_redemptions TO authenticated;
GRANT ALL ON public.referral_redemptions TO service_role;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_redemptions' AND policyname='See own redemption') THEN
    CREATE POLICY "See own redemption" ON public.referral_redemptions FOR SELECT TO authenticated
      USING (referred_user_id = auth.uid() OR referrer_user_id = auth.uid());
  END IF;
END $$;

-- Ensure the caller has a referral code (create if missing)
CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing text;
  new_code text;
  attempts int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT code INTO existing FROM public.referrals WHERE user_id = uid LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  LOOP
    attempts := attempts + 1;
    new_code := upper(substr(md5(random()::text || uid::text || clock_timestamp()::text), 1, 6));
    BEGIN
      INSERT INTO public.referrals(code, user_id) VALUES (new_code, uid);
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempts > 8 THEN RAISE; END IF;
    END;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;

-- Redeem a code: grants 14 days bonus to both parties, once per referred user
CREATE OR REPLACE FUNCTION public.redeem_referral(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref record;
  uid uuid := auth.uid();
  bonus_days int := 14;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT * INTO ref FROM public.referrals WHERE code = upper(_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_code'); END IF;
  IF ref.user_id = uid THEN RETURN jsonb_build_object('ok', false, 'error', 'self_referral'); END IF;
  IF EXISTS (SELECT 1 FROM public.referral_redemptions WHERE referred_user_id = uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;
  INSERT INTO public.referral_redemptions(code, referrer_user_id, referred_user_id, granted_days)
    VALUES (upper(_code), ref.user_id, uid, bonus_days);
  UPDATE public.referrals SET uses_count = uses_count + 1 WHERE code = upper(_code);
  UPDATE public.profiles
    SET bonus_until = GREATEST(COALESCE(bonus_until, now()), now()) + (bonus_days || ' days')::interval
    WHERE id IN (uid, ref.user_id);
  RETURN jsonb_build_object('ok', true, 'granted_days', bonus_days);
END; $$;

GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;
