-- Public buckets were accepting ANY file type at ANY size.
--
-- THE GAP
--   `avatars`, `website-assets` and `review-photos` are public-read and had
--   allowed_mime_types = NULL and file_size_limit = NULL — no constraint at the
--   storage layer at all.
--
--   The app is not careless about this: the avatar action already rejects >4MB
--   and anything failing `file.type.startsWith("image/")`, and MediaManager has
--   its own accept list. But those are per-call-site checks on a CLIENT-DECLARED
--   content type, and `startsWith("image/")` admits image/svg+xml. Every upload
--   here also runs through the SERVICE-ROLE client, so RLS is not a backstop
--   either.
--
--   So the exposure is narrow rather than dramatic — a signed-up user putting an
--   SVG, or an oversized file via any future call site that forgets the guard, on
--   the project's public storage domain with a stable URL. Not XSS against
--   wielo.co.za: storage is a different origin and uploaded assets render through
--   <img src>, never inline.
--
-- WHY BUCKET-LEVEL
--   The storage API enforces these regardless of the caller's role, so a
--   service-role upload cannot bypass them. A check in the server action alone
--   would only cover the one call site that exists today.
--
-- The values below MIRROR what each surface already accepts, so this changes no
-- behaviour — it just makes the existing rule enforceable:
--   avatars        -> same as the host-avatars bucket already uses
--   website-assets -> exactly MediaManager.tsx ACCEPTED (SVG included on purpose:
--                     it is a legitimate feature and is rendered via <img>)
--   review-photos  -> same as the listing-photos bucket already uses
--
-- marketing-assets is deliberately left alone: it has no untrusted write path
-- (admin only, service-role) and no declared type list to mirror, so guessing one
-- risks breaking an upload for no security gain.

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
       file_size_limit    = 5242880          -- 5 MB, matches host-avatars
 WHERE id = 'avatars';

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
       file_size_limit    = 10485760         -- 10 MB
 WHERE id = 'website-assets';

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
       file_size_limit    = 10485760         -- 10 MB, matches listing-photos
 WHERE id = 'review-photos';
