-- Migration: create the public review-photos storage bucket.
--
-- Reviews accept guest-uploaded photos. Files are uploaded browser → Storage
-- with a service-role signed URL (createReviewPhotoUploadUrl), then recorded in
-- review_photos. Public bucket so the listing/dashboard pages can render the
-- images via a plain public URL (reviewPhotoUrl). Object reads are also gated
-- by the public_read_review_photo_objects policy from 20260610000001.

INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
