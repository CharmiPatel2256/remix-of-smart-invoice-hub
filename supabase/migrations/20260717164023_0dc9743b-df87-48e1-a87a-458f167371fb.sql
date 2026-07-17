
CREATE POLICY "invoices storage read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "invoices storage insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "invoices storage update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "invoices storage delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
