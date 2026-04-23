
-- Create storage bucket for offer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-documents', 'offer-documents', false);

-- Authenticated users can view their own documents
CREATE POLICY "Users can view own offer documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'offer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload offer documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'offer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Authenticated users can update their own documents
CREATE POLICY "Users can update own offer documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'offer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Authenticated users can delete their own documents
CREATE POLICY "Users can delete own offer documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'offer-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
