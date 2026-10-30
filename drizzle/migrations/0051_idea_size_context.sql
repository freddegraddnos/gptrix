ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS size_dimension text CHECK (size_dimension IN ('height','width','longest')),
  ADD COLUMN IF NOT EXISTS size_source text CHECK (size_source IN ('ar_calibrated','photo_calibrated','manual')),
  ADD COLUMN IF NOT EXISTS size_unsure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS placement_unsure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_reference_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS size_dimension text CHECK (size_dimension IN ('height','width','longest')),
  ADD COLUMN IF NOT EXISTS size_source text CHECK (size_source IN ('ar_calibrated','photo_calibrated','manual')),
  ADD COLUMN IF NOT EXISTS size_unsure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS placement_unsure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_urls text[] NOT NULL DEFAULT '{}';