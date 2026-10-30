ALTER TABLE public.marketplace_motifs
  DROP CONSTRAINT IF EXISTS marketplace_motifs_price_ore_check;

ALTER TABLE public.marketplace_motifs
  ADD CONSTRAINT marketplace_motifs_price_ore_check
  CHECK (price_ore = 0 OR price_ore >= 2000);