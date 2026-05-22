-- Migration: v1.1 Storage RLS policies for refund-requests bucket
-- Per supabase_database.md §13.7
-- The bucket itself must be created via the Supabase dashboard or `supabase storage` CLI.

CREATE POLICY "guest_upload_refund_doc" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'refund-requests' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings WHERE guest_id = auth.uid()
    )
  );

CREATE POLICY "participant_read_refund_doc" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'refund-requests' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM bookings
      WHERE guest_id = auth.uid()
         OR host_id = get_my_host_id()
         OR host_id = get_my_host_id_as_staff()
    )
  );

CREATE POLICY "admin_read_refund_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'refund-requests' AND is_super_admin()
  );
