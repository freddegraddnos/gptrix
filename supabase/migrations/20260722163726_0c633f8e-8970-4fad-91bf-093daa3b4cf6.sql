CREATE POLICY "Users can view own project previews" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own project previews" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own project previews" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own project previews" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-previews' AND auth.uid()::text = (storage.foldername(name))[1]);