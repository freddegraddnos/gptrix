-- Explicit artist intent, independent of existing digital-file sales/rights.
-- NULL preserves legacy designs without claiming that they are available originals.
ALTER TABLE public.marketplace_motifs
 ADD COLUMN IF NOT EXISTS tattoo_availability text,
 ADD COLUMN IF NOT EXISTS tattoo_reuse text,
 ADD COLUMN IF NOT EXISTS suggested_size_cm double precision,
 ADD COLUMN IF NOT EXISTS tattoo_price_note text;

ALTER TABLE public.marketplace_motifs
 ADD CONSTRAINT tattoo_offer_availability_valid CHECK (tattoo_availability IS NULL OR tattoo_availability IN ('available','reserved','tattooed')),
 ADD CONSTRAINT tattoo_offer_reuse_valid CHECK (tattoo_reuse IS NULL OR tattoo_reuse IN ('unique','repeatable','customizable')),
 ADD CONSTRAINT tattoo_offer_requires_reuse CHECK (tattoo_availability IS NULL OR tattoo_reuse IS NOT NULL),
 ADD CONSTRAINT tattoo_offer_size_valid CHECK (suggested_size_cm IS NULL OR (suggested_size_cm > 0 AND suggested_size_cm <= 100)),
 ADD CONSTRAINT tattoo_offer_price_note_length CHECK (tattoo_price_note IS NULL OR length(tattoo_price_note) <= 300);
-- Existing artist-owned UPDATE/INSERT RLS applies to these columns too.
-- An enquiry never updates availability; only the artist explicitly records status.
