ALTER TABLE public.studio_slots
  ADD COLUMN IF NOT EXISTS proposed_options jsonb NOT NULL DEFAULT '[]'::jsonb;