ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS require_deposit_for_confirmation boolean NOT NULL DEFAULT false;

ALTER TABLE public.artist_client_projects
  ADD COLUMN IF NOT EXISTS acquisition_source text NOT NULL DEFAULT 'studio',
  ADD COLUMN IF NOT EXISTS sketch_reminder_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.project_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.artist_client_projects(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL,
  amount_ore integer NOT NULL CHECK (amount_ore >= 5000 AND amount_ore <= 10000000),
  currency text NOT NULL DEFAULT 'sek',
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cancelled')),
  environment text NOT NULL DEFAULT 'sandbox',
  stripe_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_deposits_one_active
  ON public.project_deposits (project_id)
  WHERE status <> 'cancelled';

GRANT SELECT, INSERT, UPDATE ON public.project_deposits TO authenticated;
GRANT ALL ON public.project_deposits TO service_role;

ALTER TABLE public.project_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project parties can read deposits"
  ON public.project_deposits FOR SELECT
  TO authenticated
  USING (public.is_artist_project_party(project_id, auth.uid()));

CREATE POLICY "Studio staff can create deposits"
  ON public.project_deposits FOR INSERT
  TO authenticated
  WITH CHECK (public.is_studio_staff(studio_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Studio staff can update unpaid deposits"
  ON public.project_deposits FOR UPDATE
  TO authenticated
  USING (public.is_studio_staff(studio_id, auth.uid()) AND status = 'unpaid')
  WITH CHECK (public.is_studio_staff(studio_id, auth.uid()) AND status IN ('unpaid', 'cancelled'));

CREATE TRIGGER project_deposits_updated_at
  BEFORE UPDATE ON public.project_deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.studio_overview(_studio uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.is_studio_staff(_studio, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for this studio';
  END IF;

  SELECT jsonb_build_object(
    'months', coalesce((
      SELECT jsonb_agg(m ORDER BY m->>'month')
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(d.month, 'YYYY-MM'),
          'bookings', (
            SELECT count(*)::int FROM public.bookings b
            WHERE b.artist_id = _studio
              AND b.status <> 'cancelled'
              AND date_trunc('month', b.preferred_date::timestamptz) = d.month
          ),
          'revenue_ore', (
            SELECT coalesce(sum(pd.amount_ore), 0)::bigint
            FROM public.project_deposits pd
            WHERE pd.studio_id = _studio AND pd.status = 'paid'
              AND date_trunc('month', pd.paid_at) = d.month
          ) + (
            SELECT coalesce(sum(p.quote_amount_ore), 0)::bigint
            FROM public.artist_client_projects p
            WHERE p.artist_id = _studio
              AND p.quote_amount_ore IS NOT NULL
              AND p.status IN ('booked', 'completed')
              AND date_trunc('month', p.updated_at) = d.month
          )
        ) AS m
        FROM generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS d(month)
      ) months
    ), '[]'::jsonb),
    'customers_total', (
      SELECT count(DISTINCT b.user_id)::int FROM public.bookings b
      WHERE b.artist_id = _studio AND b.status <> 'cancelled'
    ),
    'customers_returning', (
      SELECT count(*)::int FROM (
        SELECT b.user_id FROM public.bookings b
        WHERE b.artist_id = _studio AND b.status <> 'cancelled'
        GROUP BY b.user_id HAVING count(*) > 1
      ) r
    ),
    'projects_total', (
      SELECT count(*)::int FROM public.artist_client_projects p WHERE p.artist_id = _studio
    ),
    'projects_from_inkvision', (
      SELECT count(*)::int FROM public.artist_client_projects p
      WHERE p.artist_id = _studio AND p.acquisition_source = 'inkvision'
    )
  ) INTO _result;

  RETURN _result;
END;
$$;