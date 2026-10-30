ALTER TABLE public.project_deposits ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'deposit';
ALTER TABLE public.project_deposits ADD CONSTRAINT project_deposits_kind_check CHECK (kind IN ('deposit','final'));
ALTER TABLE public.project_deposits ADD COLUMN IF NOT EXISTS fortnox_invoice_number text;
ALTER TABLE public.project_deposits ADD COLUMN IF NOT EXISTS fortnox_exported_at timestamptz;
DROP INDEX IF EXISTS public.project_deposits_one_active;
CREATE UNIQUE INDEX project_deposits_one_active_kind ON public.project_deposits (project_id, kind) WHERE status <> 'cancelled';

ALTER TABLE public.motif_purchases ADD COLUMN IF NOT EXISTS fortnox_invoice_number text;
ALTER TABLE public.motif_purchases ADD COLUMN IF NOT EXISTS fortnox_exported_at timestamptz;

CREATE TABLE public.studio_fortnox_links (
  studio_id uuid PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  company_name text,
  sales_account integer NOT NULL DEFAULT 3001,
  vat_percent integer NOT NULL DEFAULT 25,
  payment_account integer NOT NULL DEFAULT 1580,
  fee_account integer NOT NULL DEFAULT 6570,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.studio_fortnox_links TO service_role;
ALTER TABLE public.studio_fortnox_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.studio_fortnox_status(_studio uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN NOT public.is_studio_staff(_studio, auth.uid()) THEN NULL
  ELSE (SELECT jsonb_build_object('connected', true, 'company_name', company_name,
    'sales_account', sales_account, 'vat_percent', vat_percent,
    'payment_account', payment_account, 'fee_account', fee_account)
    FROM public.studio_fortnox_links WHERE studio_id = _studio) END
$$;
REVOKE ALL ON FUNCTION public.studio_fortnox_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.studio_fortnox_status(uuid) TO authenticated;