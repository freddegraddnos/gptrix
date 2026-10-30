CREATE TABLE public.studio_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL,
  amount_ore integer NOT NULL CHECK (amount_ore > 0),
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_payouts TO authenticated;
GRANT ALL ON public.studio_payouts TO service_role;
ALTER TABLE public.studio_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio staff and admins read payouts" ON public.studio_payouts FOR SELECT TO authenticated
USING (public.is_studio_staff(studio_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_studio_payouts_studio ON public.studio_payouts (studio_id);