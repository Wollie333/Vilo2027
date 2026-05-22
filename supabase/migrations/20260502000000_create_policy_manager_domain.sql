-- Migration: Domain 11 — Policy Manager (v1.1)
-- Per supabase_database.md §14
-- Tables: policies, policy_cancellation_rules, policy_content, listing_policies, policy_snapshots
-- (Created BEFORE refund_manager so refund_requests.policy_snapshot_id FK resolves.)

-- ─── policies ─────────────────────────────────────────────────
CREATE TABLE public.policies (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id           uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  name              text    NOT NULL,
  type              text    NOT NULL
                            CHECK (type IN ('cancellation','booking_terms','privacy')),
  status            text    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','draft','archived')),

  is_non_refundable boolean NOT NULL DEFAULT false,
  preset            text
                    CHECK (preset IN ('flexible','moderate','strict','non_refundable','custom')),

  version           integer NOT NULL DEFAULT 1,
  parent_policy_id  uuid    REFERENCES policies(id) ON DELETE SET NULL,

  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_host_id ON policies(host_id);
CREATE INDEX idx_policies_type    ON policies(host_id, type);
CREATE INDEX idx_policies_status  ON policies(host_id, status) WHERE status = 'active';
CREATE INDEX idx_policies_parent  ON policies(parent_policy_id) WHERE parent_policy_id IS NOT NULL;

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- ─── policy_cancellation_rules ────────────────────────────────
CREATE TABLE public.policy_cancellation_rules (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       uuid    NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  days_before     integer NOT NULL CHECK (days_before >= 0),
  refund_percent  integer NOT NULL CHECK (refund_percent BETWEEN 0 AND 100),
  label           text    NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,

  CONSTRAINT unique_days_per_policy UNIQUE (policy_id, days_before)
);

CREATE INDEX idx_policy_rules_policy ON policy_cancellation_rules(policy_id);
CREATE INDEX idx_policy_rules_sorted ON policy_cancellation_rules(policy_id, days_before DESC);

ALTER TABLE policy_cancellation_rules ENABLE ROW LEVEL SECURITY;

-- ─── policy_content ───────────────────────────────────────────
CREATE TABLE public.policy_content (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   uuid  NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  body_html   text  NOT NULL,
  body_plain  text,
  locale      text  NOT NULL DEFAULT 'en',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_locale_per_policy UNIQUE (policy_id, locale)
);

CREATE INDEX idx_policy_content_policy ON policy_content(policy_id);

ALTER TABLE policy_content ENABLE ROW LEVEL SECURITY;

-- ─── listing_policies ─────────────────────────────────────────
CREATE TABLE public.listing_policies (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid  NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  policy_id   uuid  NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  policy_type text  NOT NULL
              CHECK (policy_type IN ('cancellation','booking_terms','privacy')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid  REFERENCES user_profiles(id) ON DELETE SET NULL,

  CONSTRAINT unique_policy_type_per_listing UNIQUE (listing_id, policy_type)
);

CREATE INDEX idx_listing_policies_listing ON listing_policies(listing_id);
CREATE INDEX idx_listing_policies_policy  ON listing_policies(policy_id);
CREATE INDEX idx_listing_policies_type    ON listing_policies(listing_id, policy_type);

ALTER TABLE listing_policies ENABLE ROW LEVEL SECURITY;

-- ─── policy_snapshots (IMMUTABLE) ─────────────────────────────
CREATE TABLE public.policy_snapshots (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid    NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  policy_id       uuid    NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  policy_type     text    NOT NULL
                          CHECK (policy_type IN ('cancellation','booking_terms','privacy')),
  policy_version  integer NOT NULL,
  policy_name     text    NOT NULL,
  snapshot_data   jsonb   NOT NULL,
  snapshotted_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_snapshot_per_booking_type UNIQUE (booking_id, policy_type)
);

CREATE INDEX idx_policy_snapshots_booking      ON policy_snapshots(booking_id);
CREATE INDEX idx_policy_snapshots_booking_type ON policy_snapshots(booking_id, policy_type);
CREATE INDEX idx_policy_snapshots_policy_id    ON policy_snapshots(policy_id);

ALTER TABLE policy_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE policy_snapshots IS
  'Immutable. One row per policy type per booking. Created by booking-create Edge Function. NEVER update or delete.';
