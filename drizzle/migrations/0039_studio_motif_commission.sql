ALTER TABLE public.motif_purchases ADD COLUMN commission_rate numeric(5,4) DEFAULT 0.05;
UPDATE public.motif_purchases SET commission_rate = 0.10 WHERE commission_rate IS NULL OR created_at < now();
ALTER TABLE public.motif_purchases ADD CONSTRAINT motif_purchases_commission_rate_range CHECK (commission_rate >= 0 AND commission_rate <= 1);