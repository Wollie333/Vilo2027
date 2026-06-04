-- Migration: let hosts read the profiles of guests they share a thread/booking with
--
-- Bug: the host inbox embeds the guest via
--   guest:user_profiles!conversations_guest_id_fkey ( full_name, email, phone, … )
-- but user_profiles only had `users_read_own` + `admin_read_all` SELECT policies.
-- A host can't read a guest's row, so the embed resolved to NULL and the thread
-- fell back to the literal "Guest" (and "—" for email/phone) everywhere — most
-- visibly on "request a quote" enquiry threads, where the visitor's name is the
-- only identity the host has.
--
-- Fix: a host (or their staff) may SELECT a user_profiles row when that user is
-- the guest on a conversation OR booking the host owns. Scoped to the host's own
-- relationships — no broader directory access. get_my_host_id() /
-- get_my_host_id_as_staff() are SECURITY DEFINER and return NULL for non-hosts,
-- so `host_id = NULL` simply matches nothing for anon/guest callers.

CREATE POLICY "host_read_guest_profiles" ON user_profiles FOR SELECT
USING (
  id IN (
    SELECT guest_id FROM conversations
      WHERE host_id = get_my_host_id() OR host_id = get_my_host_id_as_staff()
    UNION
    SELECT guest_id FROM bookings
      WHERE host_id = get_my_host_id() OR host_id = get_my_host_id_as_staff()
  )
);
