ALTER TABLE public.marketplace_motifs
ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.marketplace_motifs
ADD CONSTRAINT marketplace_motifs_category_check
CHECK (category IS NULL OR category IN ('Animals', 'Flowers', 'Mandala', 'Patterns', 'Realistic', 'Symbols', 'Landscape'));