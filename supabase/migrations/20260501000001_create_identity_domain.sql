-- Migration: Domain 1 — Identity & Access
-- Per supabase_database.md §4
-- Tables: user_profiles, hosts, staff_members, staff_invites

-- ─── user_profiles ────────────────────────────────────────────
CREATE TABLE public.user_profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'guest'
                          CHECK (role IN ('guest','host','staff','super_admin')),
  full_name   text,
  avatar_url  text,
  phone       text,
  email       text,
  is_active   boolean     NOT NULL DEFAULT true,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_role    ON user_profiles(role);
CREATE INDEX idx_user_profiles_email   ON user_profiles(email);
CREATE INDEX idx_user_profiles_deleted ON user_profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN user_profiles.role IS 'guest | host | staff | super_admin';
COMMENT ON COLUMN user_profiles.deleted_at IS 'Soft delete. Set by admin on POPIA/GDPR deletion request.';

-- Auto-create profile trigger on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── hosts ────────────────────────────────────────────────────
CREATE TABLE public.hosts (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  handle              text    UNIQUE NOT NULL,
  display_name        text    NOT NULL,
  bio                 text,
  cover_photo_url     text,
  avatar_url          text,
  website_url         text,
  languages_spoken    text[]  DEFAULT '{}',
  social_links        jsonb   DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  is_verified         boolean NOT NULL DEFAULT false,
  banking_details     jsonb,
  response_rate       numeric DEFAULT 0,
  avg_response_hours  numeric DEFAULT 0,
  total_bookings      integer NOT NULL DEFAULT 0,
  total_reviews       integer NOT NULL DEFAULT 0,
  avg_rating          numeric DEFAULT 0,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT handle_format CHECK (handle ~ '^[a-z0-9-]+$'),
  CONSTRAINT handle_length CHECK (char_length(handle) BETWEEN 3 AND 60)
);

CREATE INDEX idx_hosts_user_id     ON hosts(user_id);
CREATE INDEX idx_hosts_handle      ON hosts(handle);
CREATE INDEX idx_hosts_is_active   ON hosts(is_active) WHERE is_active = true;
CREATE INDEX idx_hosts_is_verified ON hosts(is_verified);
CREATE INDEX idx_hosts_deleted     ON hosts(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN hosts.handle IS 'URL slug. Regex: ^[a-z0-9-]+$. Used in viloplatform.com/[handle]';
COMMENT ON COLUMN hosts.banking_details IS
  'Encrypted jsonb: { bank_name, account_holder, account_number, branch_code, reference_format }';
COMMENT ON COLUMN hosts.is_verified IS 'Manually awarded by super admin after identity verification.';
COMMENT ON COLUMN hosts.response_rate IS '0.00 to 1.00. Fraction of requests responded to within 24h.';

-- ─── staff_members ────────────────────────────────────────────
CREATE TABLE public.staff_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_staff_per_host UNIQUE (host_id, user_id)
);

CREATE INDEX idx_staff_members_host_id ON staff_members(host_id);
CREATE INDEX idx_staff_members_user_id ON staff_members(user_id);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- ─── staff_invites ────────────────────────────────────────────
CREATE TABLE public.staff_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  email       text NOT NULL,
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_invites_token   ON staff_invites(token);
CREATE INDEX idx_staff_invites_host_id ON staff_invites(host_id);
CREATE INDEX idx_staff_invites_email   ON staff_invites(email);

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN staff_invites.token IS
  'Secure random hex token sent in invite email. Expires in 7 days.';
