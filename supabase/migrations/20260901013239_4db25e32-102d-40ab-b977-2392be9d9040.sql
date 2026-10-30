CREATE TABLE public.couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Our couple',
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.couple_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (couple_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE public.couple_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Matching design',
  image_data text NOT NULL,
  width_cm numeric,
  rotation numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX couple_designs_couple_idx ON public.couple_designs (couple_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.couples TO authenticated;
GRANT ALL ON public.couples TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couple_members TO authenticated;
GRANT ALL ON public.couple_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couple_designs TO authenticated;
GRANT ALL ON public.couple_designs TO service_role;

ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_designs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_couple_member(_couple_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.couple_members
    WHERE couple_id = _couple_id AND user_id = _user_id
  )
$$;

CREATE POLICY "Members can view their couple" ON public.couples
  FOR SELECT TO authenticated USING (public.is_couple_member(id, auth.uid()));
CREATE POLICY "Users can create a couple" ON public.couples
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Members can rename their couple" ON public.couples
  FOR UPDATE TO authenticated USING (public.is_couple_member(id, auth.uid()))
  WITH CHECK (public.is_couple_member(id, auth.uid()));
CREATE POLICY "Owner can delete the couple" ON public.couples
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Members can view membership" ON public.couple_members
  FOR SELECT TO authenticated USING (public.is_couple_member(couple_id, auth.uid()));
CREATE POLICY "Users can join as themselves" ON public.couple_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own membership" ON public.couple_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave their couple" ON public.couple_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Members can view couple designs" ON public.couple_designs
  FOR SELECT TO authenticated USING (public.is_couple_member(couple_id, auth.uid()));
CREATE POLICY "Members can add couple designs" ON public.couple_designs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_couple_member(couple_id, auth.uid()));
CREATE POLICY "Authors can update couple designs" ON public.couple_designs
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Authors can delete couple designs" ON public.couple_designs
  FOR DELETE TO authenticated USING (created_by = auth.uid());