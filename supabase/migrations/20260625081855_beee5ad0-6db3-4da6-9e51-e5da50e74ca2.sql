
CREATE POLICY "Users can upload own audio" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'idea-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read idea audio" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'idea-audio');

CREATE POLICY "Users can delete own audio" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'idea-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
