CREATE OR REPLACE FUNCTION public.protect_customer_booking_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side (service role) calls have no end-user JWT; app server functions
  -- authorize the caller before updating the booking.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.artist_id IS NOT NULL AND public.is_studio_staff(NEW.artist_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id = auth.uid() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.artist_id IS DISTINCT FROM OLD.artist_id
      OR NEW.studio_name IS DISTINCT FROM OLD.studio_name
      OR NEW.studio_address IS DISTINCT FROM OLD.studio_address
      OR NEW.studio_place_id IS DISTINCT FROM OLD.studio_place_id
      OR NEW.studio_lat IS DISTINCT FROM OLD.studio_lat
      OR NEW.studio_lng IS DISTINCT FROM OLD.studio_lng
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.preferred_date IS DISTINCT FROM OLD.preferred_date
      OR NEW.preferred_time IS DISTINCT FROM OLD.preferred_time
      OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
      OR NEW.body_area IS DISTINCT FROM OLD.body_area
      OR NEW.size_cm IS DISTINCT FROM OLD.size_cm
      OR NEW.note IS DISTINCT FROM OLD.note
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.slot_id IS DISTINCT FROM OLD.slot_id
      OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
      OR NEW.artist_project_id IS DISTINCT FROM OLD.artist_project_id
      OR NEW.status <> 'cancelled'
    THEN
      RAISE EXCEPTION 'Customers may only cancel their own booking';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Booking update not permitted';
END;
$$;