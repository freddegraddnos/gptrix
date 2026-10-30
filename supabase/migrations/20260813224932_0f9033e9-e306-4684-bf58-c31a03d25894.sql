ALTER TABLE public.votes
  ADD COLUMN device_id text,
  ADD COLUMN voter_ip_hash text;

CREATE UNIQUE INDEX idx_votes_unique_device
  ON public.votes(vote_session_id, device_id) WHERE device_id IS NOT NULL;

CREATE UNIQUE INDEX idx_votes_unique_ip
  ON public.votes(vote_session_id, voter_ip_hash) WHERE voter_ip_hash IS NOT NULL;

CREATE UNIQUE INDEX idx_votes_unique_user
  ON public.votes(vote_session_id, voter_user_id) WHERE voter_user_id IS NOT NULL;