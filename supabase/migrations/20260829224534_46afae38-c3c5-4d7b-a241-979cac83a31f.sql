ALTER TABLE public.vote_sessions
  ADD COLUMN IF NOT EXISTS media_type_a text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS media_type_b text;

ALTER TABLE public.vote_sessions
  DROP CONSTRAINT IF EXISTS vote_sessions_media_type_a_check;
ALTER TABLE public.vote_sessions
  ADD CONSTRAINT vote_sessions_media_type_a_check CHECK (media_type_a IN ('image','video'));
ALTER TABLE public.vote_sessions
  DROP CONSTRAINT IF EXISTS vote_sessions_media_type_b_check;
ALTER TABLE public.vote_sessions
  ADD CONSTRAINT vote_sessions_media_type_b_check CHECK (media_type_b IS NULL OR media_type_b IN ('image','video'));