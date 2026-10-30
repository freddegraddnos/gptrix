CREATE POLICY "Sketch owner reads own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sketches' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Sketch owner uploads own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sketches' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Sketch owner deletes own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sketches' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Conversation members read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Conversation members upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid, auth.uid())
);