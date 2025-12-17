-- Create storage bucket for dare proof photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dare-proofs', 
  'dare-proofs', 
  true, 
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Allow anyone to upload (for simplicity since no auth)
CREATE POLICY "Anyone can upload dare proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dare-proofs');

-- Allow anyone to view dare proofs
CREATE POLICY "Anyone can view dare proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'dare-proofs');