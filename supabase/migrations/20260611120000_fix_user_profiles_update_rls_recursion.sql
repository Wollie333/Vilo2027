-- Migration: fix infinite recursion in the user_profiles UPDATE policy
--
-- Symptom: every profile save failed with
--   "infinite recursion detected in policy for relation user_profiles".
--
-- Cause: users_update_own guarded against role escalation with an INLINE
-- subquery in WITH CHECK:
--   role = (SELECT role FROM user_profiles WHERE id = auth.uid())
-- That inline SELECT runs as the invoker, so it re-applies user_profiles SELECT
-- policies — including host_read_guest_profiles (added 2026-06-04), which fans
-- out to conversations/bookings and ultimately loops back to user_profiles.
-- Postgres detects the cycle and aborts the UPDATE.
--
-- Fix: read the current role through the existing SECURITY DEFINER helper
-- get_my_role() (created in 20260501000010). As a definer it bypasses RLS, so no
-- policy is re-evaluated and there is no recursion. The guard is unchanged: a
-- user still cannot change their own role (new.role must equal their stored role).

DROP POLICY IF EXISTS "users_update_own" ON user_profiles;

CREATE POLICY "users_update_own" ON user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = get_my_role());
