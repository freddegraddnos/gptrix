CREATE OR REPLACE FUNCTION public.protect_customer_slot_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_studio_admin(OLD.studio_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'open' AND NEW.status = 'requested' AND NEW.booked_by = auth.uid() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.studio_id IS DISTINCT FROM OLD.studio_id
      OR NEW.member_id IS DISTINCT FROM OLD.member_id
      OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
      OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
      OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
      OR NEW.price_ore IS DISTINCT FROM OLD.price_ore
      OR NEW.note IS DISTINCT FROM OLD.note
      OR NEW.client_note IS DISTINCT FROM OLD.client_note
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
      OR NEW.requires_3d IS DISTINCT FROM OLD.requires_3d
      OR NEW.scan_path IS DISTINCT FROM OLD.scan_path
      OR NEW.scan_bucket IS DISTINCT FROM OLD.scan_bucket
      OR NEW.scan_name IS DISTINCT FROM OLD.scan_name
      OR NEW.scan_note IS DISTINCT FROM OLD.scan_note
      OR NEW.scan_by IS DISTINCT FROM OLD.scan_by
      OR NEW.scan_delivered_at IS DISTINCT FROM OLD.scan_delivered_at
      OR NEW.decline_reason IS DISTINCT FROM OLD.decline_reason
      OR NEW.proposed_starts_at IS DISTINCT FROM OLD.proposed_starts_at
      OR NEW.proposed_options IS DISTINCT FROM OLD.proposed_options
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
    THEN RAISE EXCEPTION 'Only booking request fields may be changed'; END IF;
    RETURN NEW;
  END IF;

  IF OLD.booked_by = auth.uid() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.studio_id IS DISTINCT FROM OLD.studio_id
      OR NEW.member_id IS DISTINCT FROM OLD.member_id
      OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
      OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
      OR NEW.price_ore IS DISTINCT FROM OLD.price_ore
      OR NEW.note IS DISTINCT FROM OLD.note
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
      OR NEW.requires_3d IS DISTINCT FROM OLD.requires_3d
      OR NEW.scan_path IS DISTINCT FROM OLD.scan_path
      OR NEW.scan_bucket IS DISTINCT FROM OLD.scan_bucket
      OR NEW.scan_name IS DISTINCT FROM OLD.scan_name
      OR NEW.scan_note IS DISTINCT FROM OLD.scan_note
      OR NEW.scan_by IS DISTINCT FROM OLD.scan_by
      OR NEW.scan_delivered_at IS DISTINCT FROM OLD.scan_delivered_at
      OR NEW.decline_reason IS DISTINCT FROM OLD.decline_reason
      OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
    THEN RAISE EXCEPTION 'Customers may only cancel or respond to a proposed time'; END IF;
    IF NOT (
      (NEW.status = 'open' AND NEW.booked_by IS NULL AND NEW.booked_at IS NULL AND NEW.client_note IS NULL AND NEW.proposed_starts_at IS NULL AND NEW.proposed_options = '[]'::jsonb AND NEW.approved_at IS NULL)
      OR (NEW.status = 'booked' AND NEW.booked_by = OLD.booked_by AND OLD.proposed_starts_at IS NOT NULL AND NEW.starts_at = COALESCE(NEW.starts_at, OLD.proposed_starts_at) AND NEW.proposed_starts_at IS NULL AND NEW.proposed_options = '[]'::jsonb AND NEW.approved_at IS NOT NULL)
    ) THEN RAISE EXCEPTION 'Invalid customer booking transition'; END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Slot update not permitted';
END;
$$;