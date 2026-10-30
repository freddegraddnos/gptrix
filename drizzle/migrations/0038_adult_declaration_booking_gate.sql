ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS adult_declared_at timestamptz;
COMMENT ON COLUMN public.profiles.adult_declared_at IS 'User self-declared age 18+; not an ID verification.';

CREATE OR REPLACE FUNCTION public.booking_adult_declared(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user AND adult_declared_at IS NOT NULL) $$;
REVOKE ALL ON FUNCTION public.booking_adult_declared(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_adult_declared(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_booking_adult()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  IF NOT public.booking_adult_declared(NEW.user_id) THEN
    RAISE EXCEPTION 'Confirm you are 18 or older before sending a booking request.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_booking_adult() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_booking_adult_before_insert BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_adult();

CREATE OR REPLACE FUNCTION public.enforce_slot_adult()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  IF NEW.status = 'requested' AND NEW.booked_by IS NOT NULL AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.booked_by IS DISTINCT FROM NEW.booked_by) AND NOT public.booking_adult_declared(NEW.booked_by) THEN
    RAISE EXCEPTION 'Confirm you are 18 or older before requesting a studio time.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_slot_adult() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_slot_adult_before_update BEFORE UPDATE ON public.studio_slots FOR EACH ROW EXECUTE FUNCTION public.enforce_slot_adult();

CREATE OR REPLACE FUNCTION public.enforce_project_request_adult()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  IF NEW.client_user_id IS NOT NULL AND NEW.artist_id IS NOT NULL AND NOT public.booking_adult_declared(NEW.client_user_id) THEN
    RAISE EXCEPTION 'Confirm you are 18 or older before sending a tattoo request.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_project_request_adult() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_project_request_adult_before_insert BEFORE INSERT ON public.artist_client_projects FOR EACH ROW EXECUTE FUNCTION public.enforce_project_request_adult();