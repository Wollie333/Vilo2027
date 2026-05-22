-- Migration: RLS Helper Functions
-- Per supabase_database.md §15 (Helper Functions)
-- These functions are referenced by RLS policies. Must be created BEFORE policies.

-- Returns the current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Returns the host_id the current user owns
CREATE OR REPLACE FUNCTION get_my_host_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM hosts WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns the host_id the current user belongs to as staff
CREATE OR REPLACE FUNCTION get_my_host_id_as_staff()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT host_id FROM staff_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns true if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;
