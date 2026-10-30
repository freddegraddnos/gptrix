ALTER TABLE public.marketplace_motifs DROP CONSTRAINT IF EXISTS marketplace_motifs_category_check;
ALTER TABLE public.marketplace_motifs ADD CONSTRAINT marketplace_motifs_category_check
  CHECK (category IS NULL OR category = ANY (ARRAY['Animals','Flowers','Japanese','Mandala','Patterns','Realistic','Symbols','Landscape']));

UPDATE public.marketplace_motifs SET category = 'Japanese' WHERE name IN ('Irezumi Koi Upstream','Oni Mask','Coiled Ryu Dragon','Sakura Branch','Hannya Mask','Ho-o Phoenix','Great Waves','Tiger in Bamboo','Geisha Portrait','Kiku Chrysanthemum','Hannya & Waves','Koi & Waves','Great Wave','Koi & Ripples','Eastern Dragon','Dragon Flight');
UPDATE public.marketplace_motifs SET category = 'Realistic' WHERE name IN ('Black Panther','Horse Portrait','Bear Portrait','Soaring Eagle','Wolf Portrait');
UPDATE public.marketplace_motifs SET category = 'Animals' WHERE name = 'Monarch Butterfly';