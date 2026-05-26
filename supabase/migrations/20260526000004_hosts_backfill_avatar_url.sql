-- Backfill hosts.avatar_url from user_profiles.avatar_url for any host whose
-- avatar was uploaded via the onboarding wizard BEFORE the finalize action
-- was updated to mirror the URL onto hosts. The public host page + listing
-- HostCard read hosts.avatar_url directly, so without this they render
-- the empty placeholder even when the user has a profile photo.
--
-- Idempotent: only updates rows where hosts.avatar_url IS NULL.

UPDATE public.hosts h
SET    avatar_url = up.avatar_url
FROM   public.user_profiles up
WHERE  h.user_id = up.id
  AND  h.avatar_url IS NULL
  AND  up.avatar_url IS NOT NULL;
