
CREATE POLICY "Users update own audio" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'idea-audio' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'idea-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
