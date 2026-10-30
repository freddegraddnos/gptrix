CREATE OR REPLACE FUNCTION public.protect_artist_project_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.client_user_id
     AND NOT public.is_studio_staff(OLD.artist_id, auth.uid())
     AND (
       NEW.artist_id IS DISTINCT FROM OLD.artist_id OR
       NEW.client_user_id IS DISTINCT FROM OLD.client_user_id OR
       NEW.client_name IS DISTINCT FROM OLD.client_name OR
       NEW.client_email IS DISTINCT FROM OLD.client_email OR
       NEW.client_phone IS DISTINCT FROM OLD.client_phone OR
       NEW.title IS DISTINCT FROM OLD.title OR
       NEW.notes IS DISTINCT FROM OLD.notes OR
       NEW.base_photo_url IS DISTINCT FROM OLD.base_photo_url OR
       NEW.motif_url IS DISTINCT FROM OLD.motif_url OR
       NEW.design IS DISTINCT FROM OLD.design OR
       NEW.before_url IS DISTINCT FROM OLD.before_url OR
       NEW.after_url IS DISTINCT FROM OLD.after_url OR
       NEW.preview_token IS DISTINCT FROM OLD.preview_token OR
       NEW.invite_token IS DISTINCT FROM OLD.invite_token OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.placement IS DISTINCT FROM OLD.placement OR
       NEW.size_cm IS DISTINCT FROM OLD.size_cm OR
       NEW.color_mode IS DISTINCT FROM OLD.color_mode OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.assigned_artist_id IS DISTINCT FROM OLD.assigned_artist_id OR
       NEW.quote_amount_ore IS DISTINCT FROM OLD.quote_amount_ore OR
       NEW.quote_message IS DISTINCT FROM OLD.quote_message OR
       NEW.quote_status IS DISTINCT FROM OLD.quote_status OR
       NEW.source_project_id IS DISTINCT FROM OLD.source_project_id OR
       NEW.scan_id IS DISTINCT FROM OLD.scan_id
     )
  THEN
    RAISE EXCEPTION 'Clients may only approve publishing';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER artist_client_projects_protect_client_updates
BEFORE UPDATE ON public.artist_client_projects
FOR EACH ROW EXECUTE FUNCTION public.protect_artist_project_client_updates();

CREATE OR REPLACE FUNCTION public.sync_artist_project_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.artist_project_id IS NOT NULL AND NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.artist_client_projects
    SET status = 'booked', latest_activity_at = now()
    WHERE id = NEW.artist_project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_sync_artist_project_status_on_insert
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_artist_project_booking_status();