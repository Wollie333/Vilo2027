-- Enforce photo size + type at the storage layer, not just in the browser.
--
-- The signed-upload path (createListingPhotoUploadUrl -> uploadToSignedUrl) and
-- the avatar upload only validated size/MIME client-side; a client bypassing the
-- picker could register an oversized or non-image object. Bucket file_size_limit
-- + allowed_mime_types are enforced by Storage for EVERY upload (signed,
-- resumable, service-role), so this closes the bypass server-side. Limits match
-- the existing client caps (PHOTO_MAX_BYTES = 8 MB; avatar cap = 4 MB) and the
-- accepted types (image/jpeg, image/png, image/webp).

update storage.buckets
set file_size_limit = 8388608, -- 8 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'listing-photos';

update storage.buckets
set file_size_limit = 4194304, -- 4 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';
