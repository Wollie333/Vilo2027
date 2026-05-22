-- Migration: Supabase Storage RLS policies (v1.0)
-- Per supabase_database.md §20
-- Buckets themselves (listing-photos, host-avatars, host-covers, eft-proofs, message-attachments)
-- must be created via the Supabase dashboard or `supabase storage` CLI — this migration only
-- declares the per-bucket RLS policies.

-- ─── listing-photos: public read, host write ──────────────────
CREATE POLICY "public_read_listing_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'listing-photos');

CREATE POLICY "host_upload_listing_photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'listing-photos' AND auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM listings WHERE host_id = get_my_host_id()
    )
  );

CREATE POLICY "host_delete_listing_photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'listing-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM listings WHERE host_id = get_my_host_id()
    )
  );

-- ─── eft-proofs: booking participants only ────────────────────
CREATE POLICY "eft_proof_participant_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'eft-proofs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings
      WHERE guest_id = auth.uid() OR host_id = get_my_host_id()
    )
  );

CREATE POLICY "guest_upload_eft_proof" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'eft-proofs' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings WHERE guest_id = auth.uid()
    )
  );

-- ─── message-attachments: conversation participants only ──────
CREATE POLICY "participant_read_attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM conversations
      WHERE host_id = get_my_host_id()
         OR host_id = get_my_host_id_as_staff()
         OR guest_id = auth.uid()
    )
  );
