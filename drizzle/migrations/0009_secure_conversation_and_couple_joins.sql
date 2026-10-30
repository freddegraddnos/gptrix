-- 1. Direct conversations may only be created through a validated RPC.
CREATE OR REPLACE FUNCTION public.open_direct_conversation(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _conv uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _other IS NULL OR _other = _me THEN RAISE EXCEPTION 'invalid_recipient'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other) THEN
    RAISE EXCEPTION 'invalid_recipient';
  END IF;

  SELECT m1.conversation_id INTO _conv
  FROM public.conversation_members m1
  JOIN public.conversation_members m2 ON m2.conversation_id = m1.conversation_id
  WHERE m1.user_id = _me AND m2.user_id = _other
    AND (SELECT count(*) FROM public.conversation_members m3
         WHERE m3.conversation_id = m1.conversation_id) = 2
  LIMIT 1;
  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO _conv;
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (_conv, _me), (_conv, _other);
  RETURN _conv;
END;
$$;

REVOKE ALL ON FUNCTION public.open_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_direct_conversation(uuid) TO authenticated;

-- Clients may no longer add themselves to arbitrary conversations.
DROP POLICY IF EXISTS "Users insert own membership" ON public.conversation_members;

-- 2. Couple membership: creators may add themselves, everyone else joins with a code.
DROP POLICY IF EXISTS "Users can join as themselves" ON public.couple_members;

CREATE POLICY "Creators add themselves to their couple"
ON public.couple_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = couple_id AND c.created_by = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.join_couple_by_code(_code text, _display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _couple uuid;
  _members int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT id INTO _couple FROM public.couples
   WHERE upper(invite_code) = upper(btrim(coalesce(_code, ''))) LIMIT 1;
  IF _couple IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;

  IF EXISTS (SELECT 1 FROM public.couple_members
              WHERE couple_id = _couple AND user_id = _me) THEN
    RETURN _couple;
  END IF;

  SELECT count(*) INTO _members FROM public.couple_members WHERE couple_id = _couple;
  IF _members >= 2 THEN RAISE EXCEPTION 'couple_full'; END IF;

  INSERT INTO public.couple_members (couple_id, user_id, display_name)
  VALUES (_couple, _me, nullif(btrim(coalesce(_display_name, '')), ''));
  RETURN _couple;
END;
$$;

REVOKE ALL ON FUNCTION public.join_couple_by_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_couple_by_code(text, text) TO authenticated;