-- Migration: Domain 5 — Subscriptions & Feature Control
-- Per supabase_database.md §8
-- Tables: subscriptions, subscription_history, plan_features, host_feature_overrides

-- ─── subscriptions ────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id                    uuid    UNIQUE NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,

  plan                       text    NOT NULL DEFAULT 'free'
                                     CHECK (plan IN ('free','basic','pro','business')),
  billing_cycle              text    CHECK (billing_cycle IN ('monthly','annual')),
  status                     text    NOT NULL DEFAULT 'active'
                                     CHECK (status IN (
                                       'trialing','active','past_due',
                                       'restricted','cancelled','expired'
                                     )),

  trial_ends_at              timestamptz,

  current_period_start       timestamptz,
  current_period_end         timestamptz,

  grace_period_ends_at       timestamptz,
  failed_payment_count       integer NOT NULL DEFAULT 0,

  paystack_customer_code     text,
  paystack_subscription_code text,
  paypal_subscription_id     text,
  paypal_plan_id             text,

  cancel_at_period_end       boolean NOT NULL DEFAULT false,
  cancelled_at               timestamptz,
  cancellation_reason        text,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_host_id ON subscriptions(host_id);
CREATE INDEX idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX idx_subscriptions_plan    ON subscriptions(plan);
CREATE INDEX idx_subscriptions_period  ON subscriptions(current_period_end)
  WHERE status IN ('active','trialing','past_due');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN subscriptions.grace_period_ends_at IS
  'Set to now() + 5 days when payment fails. Account restricted after this timestamp.';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS
  'If true, active until current_period_end then downgrades to free plan.';

-- ─── subscription_history (append-only) ───────────────────────
CREATE TABLE public.subscription_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  host_id         uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  event           text NOT NULL,
  from_plan       text,
  to_plan         text,
  from_status     text,
  to_status       text,
  amount_charged  numeric,
  currency        text,
  notes           text,
  performed_by    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_history_subscription ON subscription_history(subscription_id);
CREATE INDEX idx_sub_history_host_id      ON subscription_history(host_id);
CREATE INDEX idx_sub_history_created_at   ON subscription_history(created_at DESC);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE subscription_history IS
  'Immutable append-only audit log of all subscription changes. No UPDATE or DELETE.';

-- ─── plan_features ────────────────────────────────────────────
CREATE TABLE public.plan_features (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan         text    NOT NULL CHECK (plan IN ('free','basic','pro','business')),
  feature_key  text    NOT NULL,
  is_enabled   boolean NOT NULL DEFAULT false,
  limit_value  integer,
  description  text,
  updated_by   uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_plan_feature UNIQUE (plan, feature_key)
);

CREATE INDEX idx_plan_features_plan ON plan_features(plan);
CREATE INDEX idx_plan_features_key  ON plan_features(feature_key);

ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN plan_features.limit_value IS
  'NULL = unlimited. Integer = cap. Used for inbox_limit, listings_limit, staff_seats.';

-- ─── host_feature_overrides ───────────────────────────────────
CREATE TABLE public.host_feature_overrides (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid    NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  feature_key   text    NOT NULL,
  is_enabled    boolean NOT NULL,
  limit_value   integer,
  reason        text    NOT NULL,
  overridden_by uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_host_feature_override UNIQUE (host_id, feature_key)
);

CREATE INDEX idx_host_overrides_host_id ON host_feature_overrides(host_id);
CREATE INDEX idx_host_overrides_expires ON host_feature_overrides(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE host_feature_overrides ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN host_feature_overrides.expires_at IS
  'NULL = permanent. Integer = temporary courtesy override.';
COMMENT ON COLUMN host_feature_overrides.reason IS
  'Required. Admin must provide reasoning for audit trail.';
