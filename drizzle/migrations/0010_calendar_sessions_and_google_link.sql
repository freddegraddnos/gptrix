ALTER TABLE public.studio_slots
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'studio',
  ADD COLUMN IF NOT EXISTS external_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS studio_slots_external_event_idx
  ON public.studio_slots (studio_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS session_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS session_minutes integer NOT NULL DEFAULT 120;

ALTER TABLE public.artist_client_projects
  ADD CONSTRAINT artist_client_projects_session_count_check CHECK (session_count BETWEEN 1 AND 20) NOT VALID;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS session_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS slot_starts_at timestamptz;

CREATE TABLE IF NOT EXISTS public.studio_calendar_links (
  studio_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id text NOT NULL DEFAULT 'google_calendar',
  connection_key_ciphertext text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  account_email text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.studio_calendar_links TO service_role;
ALTER TABLE public.studio_calendar_links ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_studio_calendar_links_updated_at ON public.studio_calendar_links;
CREATE TRIGGER set_studio_calendar_links_updated_at
  BEFORE UPDATE ON public.studio_calendar_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Studios can see whether their own calendar is linked (never the key).
CREATE OR REPLACE FUNCTION public.studio_calendar_status(_studio uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT public.is_studio_staff(_studio, auth.uid()) THEN jsonb_build_object('allowed', false)
    ELSE (
      SELECT jsonb_build_object(
        'allowed', true,
        'linked', l.studio_id IS NOT NULL,
        'calendar_id', l.calendar_id,
        'account_email', l.account_email,
        'last_synced_at', l.last_synced_at
      )
      FROM (SELECT 1) one
      LEFT JOIN public.studio_calendar_links l ON l.studio_id = _studio
    )
  END
$function$;

GRANT EXECUTE ON FUNCTION public.studio_calendar_status(uuid) TO authenticated;
