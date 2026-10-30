
-- Drop old redemption FK, then referrals table
ALTER TABLE public.referral_redemptions DROP CONSTRAINT IF EXISTS referral_redemptions_code_fkey;
DROP TABLE IF EXISTS public.referrals;

-- Rewrite ensure_referral_code to use profiles.referral_code
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
  SELECT referral_code INTO existing FROM public.profiles WHERE id = uid;
  IF existing IS NOT NULL AND length(existing) > 0 THEN RETURN existing; END IF;
  LOOP
    attempts := attempts + 1;
    new_code := upper(substr(md5(random()::text || uid::text || clock_timestamp()::text), 1, 6));
    BEGIN
      UPDATE public.profiles SET referral_code = new_code WHERE id = uid;
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempts > 8 THEN RAISE; END IF;
    END;
  END LOOP;
END; $$;

-- Rewrite redeem_referral: lookup by profiles.referral_code, grant 14 days bonus
CREATE OR REPLACE FUNCTION public.redeem_referral(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_user uuid;
  uid uuid := auth.uid();
  bonus_days int := 14;
  norm_code text := upper(_code);
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  SELECT id INTO ref_user FROM public.profiles WHERE upper(referral_code) = norm_code LIMIT 1;
  IF ref_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_code'); END IF;
  IF ref_user = uid THEN RETURN jsonb_build_object('ok', false, 'error', 'self_referral'); END IF;
  IF EXISTS (SELECT 1 FROM public.referral_redemptions WHERE referred_user_id = uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;
  INSERT INTO public.referral_redemptions(code, referrer_user_id, referred_user_id, granted_days)
    VALUES (norm_code, ref_user, uid, bonus_days);
  UPDATE public.profiles
    SET bonus_until = GREATEST(COALESCE(bonus_until, now()), now()) + (bonus_days || ' days')::interval
    WHERE id IN (uid, ref_user);
  RETURN jsonb_build_object('ok', true, 'granted_days', bonus_days);
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated;
