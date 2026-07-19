-- CORRECTIVE: host_public_suppressed(uuid) is called by RLS policies
-- (properties.public_read_published, specials.specials_public_read) to hide a
-- suppressed host's public rows from signed-out visitors. It MUST be executable
-- by anon/authenticated or every SIGNED-OUT read of those tables raises 42501 —
-- the public directory + deals pages go down. 20260719170000 wrongly revoked it
-- as an "internal helper". It leaks nothing (returns a boolean), so anon execute
-- is correct here — like get_listing_policy_summary.
GRANT EXECUTE ON FUNCTION public.host_public_suppressed(uuid) TO anon, authenticated;
