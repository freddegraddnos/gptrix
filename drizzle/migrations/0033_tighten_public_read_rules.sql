-- Conversations are only created through open_direct_conversation()
DROP POLICY IF EXISTS "Authenticated create conversations" ON public.conversations;

-- Studio tables: only approved studios are publicly visible; staff always see their own
DROP POLICY IF EXISTS "Studio gallery is public" ON public.studio_gallery;
CREATE POLICY "Approved studio gallery is visible" ON public.studio_gallery
  FOR SELECT TO anon, authenticated
  USING (public.is_approved_studio(studio_id) OR public.is_studio_staff(studio_id, auth.uid()));

DROP POLICY IF EXISTS "Studio artists are public" ON public.studio_artists;
CREATE POLICY "Active artists of approved studios are visible" ON public.studio_artists
  FOR SELECT TO anon, authenticated
  USING ((active AND public.is_approved_studio(studio_id)) OR public.is_studio_staff(studio_id, auth.uid()));

DROP POLICY IF EXISTS "Availability is public" ON public.studio_availability;
CREATE POLICY "Active availability of approved studios is visible" ON public.studio_availability
  FOR SELECT TO anon, authenticated
  USING ((active AND public.is_approved_studio(studio_id)) OR public.is_studio_staff(studio_id, auth.uid()));

-- Storage: studio media only for approved studios or own staff
DROP POLICY IF EXISTS "Studio media is readable" ON storage.objects;
CREATE POLICY "Studio media readable for approved studios" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'studio'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_approved_studio(((storage.foldername(name))[1])::uuid)
      OR public.is_studio_staff(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

-- Storage: marketplace images only for published motifs or the artist's own files
DROP POLICY IF EXISTS "Marketplace images publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Marketplace images readable by authenticated" ON storage.objects;
CREATE POLICY "Marketplace images of published motifs or own" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'marketplace'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (SELECT 1 FROM public.marketplace_motifs m WHERE m.image_path = name AND m.published)
    )
  );

-- Storage: community images only when attached to a post, or own uploads
DROP POLICY IF EXISTS "Community images readable by authenticated" ON storage.objects;
CREATE POLICY "Community images of posts or own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'community'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (SELECT 1 FROM public.posts p WHERE p.image_path = name)
    )
  );