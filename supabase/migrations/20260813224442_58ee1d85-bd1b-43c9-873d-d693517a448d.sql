CREATE TYPE public.vote_session_type AS ENUM ('yes_no', 'a_b');
CREATE TYPE public.vote_choice AS ENUM ('yes', 'no', 'a', 'b');
CREATE TYPE public.voter_type AS ENUM ('guest', 'user');

CREATE TABLE public.vote_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.vote_session_type NOT NULL,
  image_url_a text NOT NULL,
  image_url_b text,
  caption text,
  is_profile_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX idx_vote_sessions_creator ON public.vote_sessions(creator_user_id);

GRANT SELECT ON public.vote_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vote_sessions TO authenticated;
GRANT ALL ON public.vote_sessions TO service_role;

ALTER TABLE public.vote_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active vote sessions"
  ON public.vote_sessions FOR SELECT TO anon, authenticated
  USING (expires_at > now());

CREATE POLICY "Creators can view own vote sessions"
  ON public.vote_sessions FOR SELECT TO authenticated
  USING (auth.uid() = creator_user_id);

CREATE POLICY "Creators can create vote sessions"
  ON public.vote_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "Creators can update own vote sessions"
  ON public.vote_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = creator_user_id) WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "Creators can delete own vote sessions"
  ON public.vote_sessions FOR DELETE TO authenticated
  USING (auth.uid() = creator_user_id);

CREATE TRIGGER vote_sessions_updated_at BEFORE UPDATE ON public.vote_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vote_session_id uuid NOT NULL REFERENCES public.vote_sessions(id) ON DELETE CASCADE,
  choice public.vote_choice NOT NULL,
  voter_type public.voter_type NOT NULL DEFAULT 'guest',
  voter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voter_display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_votes_session ON public.votes(vote_session_id);

GRANT INSERT ON public.votes TO anon;
GRANT SELECT, INSERT ON public.votes TO authenticated;
GRANT ALL ON public.votes TO service_role;

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can vote on active sessions"
  ON public.votes FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vote_sessions s WHERE s.id = vote_session_id AND s.expires_at > now())
    AND (
      (voter_type = 'guest' AND voter_user_id IS NULL)
      OR (voter_type = 'user' AND voter_user_id = auth.uid())
    )
  );

CREATE POLICY "Session creators can read votes"
  ON public.votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vote_sessions s WHERE s.id = vote_session_id AND s.creator_user_id = auth.uid()));

CREATE POLICY "Voters can read own votes"
  ON public.votes FOR SELECT TO authenticated
  USING (voter_user_id = auth.uid());