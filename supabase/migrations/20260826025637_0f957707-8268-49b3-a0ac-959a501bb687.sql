ALTER TABLE public.vote_sessions
  ADD COLUMN IF NOT EXISTS reaction_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.vote_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_session_id uuid NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL,
  media_path text NOT NULL,
  media_type text NOT NULL DEFAULT 'video/webm',
  reactor_name text,
  choice text,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_reactions_session_idx ON public.vote_reactions (vote_session_id, created_at DESC);

GRANT SELECT, DELETE ON public.vote_reactions TO authenticated;
GRANT ALL ON public.vote_reactions TO service_role;

ALTER TABLE public.vote_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators can view their reactions" ON public.vote_reactions;
CREATE POLICY "Creators can view their reactions"
  ON public.vote_reactions FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid());

DROP POLICY IF EXISTS "Creators can delete their reactions" ON public.vote_reactions;
CREATE POLICY "Creators can delete their reactions"
  ON public.vote_reactions FOR DELETE TO authenticated
  USING (creator_user_id = auth.uid());