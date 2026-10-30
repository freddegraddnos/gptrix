CREATE POLICY "Marketplace images publicly readable"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'marketplace');