-- New studios prepare a private draft after confirmed-email authentication.
-- Existing profiles, approval decisions, records and module preferences are unchanged.
CREATE OR REPLACE FUNCTION public.protect_studio_approval_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE protected_key text;
BEGIN
  -- Administrative server operations keep using the existing approval workflow.
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Create studio drafts through the authenticated startup workflow';
  ELSE
    FOREACH protected_key IN ARRAY ARRAY[
      'user_id', 'status', 'approval_status', 'approval_requested_at',
      'approval_token', 'approval_token_used_at', 'approved_at', 'approval_note',
      'verified', 'verified_at', 'verification_status', 'verification_note', 'email_verified_at'
    ] LOOP
      IF to_jsonb(NEW)->protected_key IS DISTINCT FROM to_jsonb(OLD)->protected_key THEN
        RAISE EXCEPTION 'Studio approval and verification are managed by the review workflow';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_studio_approval_fields BEFORE INSERT OR UPDATE
  ON public.artist_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_studio_approval_fields();

CREATE OR REPLACE FUNCTION public.create_studio_draft(_name text, _city text, _goal text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  contact text;
  profile_id uuid;
  chosen_modules text[];
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in before creating a studio draft'; END IF;
  SELECT email INTO contact FROM auth.users
    WHERE id = actor AND email_confirmed_at IS NOT NULL;
  IF contact IS NULL OR btrim(contact) = '' THEN RAISE EXCEPTION 'Confirm your email before creating a studio draft'; END IF;
  IF char_length(btrim(_name)) NOT BETWEEN 2 AND 120 OR _name IS NULL THEN
    RAISE EXCEPTION 'Studio name must contain 2 to 120 characters';
  END IF;
  IF char_length(coalesce(_city, '')) > 120 THEN RAISE EXCEPTION 'City is too long'; END IF;
  chosen_modules := CASE _goal
    WHEN 'presence' THEN ARRAY['requests']
    WHEN 'designs' THEN ARRAY['requests','designs']
    WHEN 'booking' THEN ARRAY['requests','booking']
    ELSE NULL END;
  IF chosen_modules IS NULL THEN RAISE EXCEPTION 'Choose a studio goal'; END IF;

  -- Serialize retries for this account. Returning an existing studio never resets it.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  SELECT id INTO profile_id FROM public.artist_profiles WHERE user_id = actor;
  IF profile_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', profile_id, 'created', false);
  END IF;
  IF EXISTS (SELECT 1 FROM public.studio_members WHERE user_id = actor
    AND status = 'active' AND role IN ('admin','artist')) THEN
    RAISE EXCEPTION 'This account already belongs to a studio team. Open your studio requests.';
  END IF;

  INSERT INTO public.artist_profiles(user_id, studio_name, contact_email, city, handle, status, approval_status)
    VALUES (actor, btrim(_name), contact, nullif(btrim(_city), ''),
      'studio-' || replace(actor::text, '-', ''), 'pending', 'pending')
    ON CONFLICT (user_id) DO NOTHING RETURNING id INTO profile_id;
  IF profile_id IS NULL THEN
    SELECT id INTO profile_id FROM public.artist_profiles WHERE user_id = actor;
    RETURN jsonb_build_object('id', profile_id, 'created', false);
  END IF;
  INSERT INTO public.studio_module_preferences(studio_id, enabled) VALUES (actor, chosen_modules);
  RETURN jsonb_build_object('id', profile_id, 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_studio_draft(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_studio_draft(text, text, text) TO authenticated;
