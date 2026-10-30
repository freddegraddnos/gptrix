CREATE POLICY "Users manage own vote images"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'votes' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'votes' AND owner = auth.uid());