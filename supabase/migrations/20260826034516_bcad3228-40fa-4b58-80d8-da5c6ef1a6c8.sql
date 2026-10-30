CREATE TABLE public.scan_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.body_scans(id) ON DELETE CASCADE,
  share_id uuid REFERENCES public.scan_shares(id) ON DELETE SET NULL,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  body text NOT NULL,
  pos_x double precision NOT NULL,
  pos_y double precision NOT NULL,
  pos_z double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.scan_annotations TO authenticated;
GRANT ALL ON public.scan_annotations TO service_role;

ALTER TABLE public.scan_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scan owner can read annotations"
ON public.scan_annotations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.body_scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));

CREATE POLICY "Authors can read own annotations"
ON public.scan_annotations FOR SELECT TO authenticated
USING (author_user_id = auth.uid());

CREATE POLICY "Scan owner can add annotations"
ON public.scan_annotations FOR INSERT TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.body_scans s WHERE s.id = scan_id AND s.user_id = auth.uid())
);

CREATE POLICY "Scan owner can delete annotations"
ON public.scan_annotations FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.body_scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));

CREATE INDEX scan_annotations_scan_idx ON public.scan_annotations(scan_id, created_at);

-- Read annotations through a share link (no login required for the studio).
CREATE OR REPLACE FUNCTION public.scan_annotations_by_token(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'author_name', a.author_name, 'body', a.body,
    'x', a.pos_x, 'y', a.pos_y, 'z', a.pos_z, 'created_at', a.created_at
  ) ORDER BY a.created_at), '[]'::jsonb)
  FROM public.scan_shares sh
  JOIN public.scan_annotations a ON a.scan_id = sh.scan_id
  WHERE sh.token = _token
    AND sh.revoked = false
    AND sh.expires_at > now();
$$;

-- Add an annotation through a valid share link.
CREATE OR REPLACE FUNCTION public.add_scan_annotation(
  _token text, _name text, _body text,
  _x double precision, _y double precision, _z double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _sh public.scan_shares;
BEGIN
  IF _body IS NULL OR length(btrim(_body)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty');
  END IF;
  SELECT * INTO _sh FROM public.scan_shares
   WHERE token = _token AND revoked = false AND expires_at > now();
  IF _sh.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  INSERT INTO public.scan_annotations (scan_id, share_id, author_user_id, author_name, body, pos_x, pos_y, pos_z)
  VALUES (_sh.scan_id, _sh.id, auth.uid(), nullif(btrim(coalesce(_name, '')), ''), left(btrim(_body), 1000), _x, _y, _z);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Store a manual calibration made in the 3D viewer.
CREATE OR REPLACE FUNCTION public.set_scan_scale(_scan_id uuid, _scale numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _scale IS NULL OR _scale <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  UPDATE public.body_scans
     SET scale_factor = _scale, calibrated = true, scale_confidence = 1.0
   WHERE id = _scan_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;