-- =============================================================================
-- Looking-For credit allowances — Phase 1 (schema).
-- Plan: docs/features/LOOKING_FOR_CREDIT_ALLOWANCES_PLAN.md
--
-- Founder ask: admin controls how many quote REQUESTS (leads) a host receives
-- per month and how many quote RESPONSES they may send, per plan with a per-host
-- override, metered by credits — run out, buy a credit package.
--
-- NOTE ON SCOPE: no allowance table is created. `check_feature_permission`
-- already resolves a numeric `limit_value` with exactly the precedence we need
-- (host_feature_overrides -> product_features -> plan_features -> default), and
-- the admin UI to set it already exists (/admin/products ProductEditor and
-- /admin/platform/features HostOverrideForm). Adding the two feature keys to the
-- canonical catalog gives the whole admin surface for free. The only genuinely
-- new object is the unlock ledger below.
-- =============================================================================

-- Which Looking-For leads a host has spent a credit to see.
-- UNIQUE(post_id, host_id) is the idempotency key: a host can never be charged
-- twice for the same lead, no matter how many times the unlock action fires.
CREATE TABLE looking_for_post_unlocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, host_id)
);

-- The board asks "which of these posts has this host unlocked?" on every render.
CREATE INDEX looking_for_post_unlocks_host_idx
  ON looking_for_post_unlocks (host_id, post_id);

ALTER TABLE looking_for_post_unlocks ENABLE ROW LEVEL SECURITY;

-- A host may read its own unlocks. Writes go through the server action, which
-- spends the credit first — never let a client insert its way to a free lead.
CREATE POLICY looking_for_post_unlocks_select_own
  ON looking_for_post_unlocks
  FOR SELECT
  USING (
    host_id IN (
      SELECT h.id FROM hosts h
      WHERE h.user_id = auth.uid() AND h.deleted_at IS NULL
    )
  );

-- -----------------------------------------------------------------------------
-- Plan-level defaults for the two new allowances.
--
-- plan_features is the last resort in check_feature_permission's precedence and
-- is currently EMPTY on live, so without a row here a host on a product that
-- doesn't set these keys resolves to the fail-closed default (0 = everything
-- locked). Seed a baseline so the board keeps working; admins can override per
-- product or per host from the existing screens.
--
-- Numbers carried from `looking_for_quotas.host_quotes_per_month` — the founder's
-- own prior intent, from the table this epic retires (free 0 / pro 50 /
-- business 200; 'basic' is not a live subscriptions.plan value so it is skipped).
-- Leads mirror quotes for now; these are starting points to be set for real in
-- the admin UI, not a pricing commitment.
-- -----------------------------------------------------------------------------

INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value)
VALUES
  ('free',     'looking_for_quote_responses_per_month', TRUE,  0),
  ('pro',      'looking_for_quote_responses_per_month', TRUE,  50),
  ('business', 'looking_for_quote_responses_per_month', TRUE,  200),
  ('free',     'looking_for_quote_requests_per_month',  TRUE,  0),
  ('pro',      'looking_for_quote_requests_per_month',  TRUE,  50),
  ('business', 'looking_for_quote_requests_per_month',  TRUE,  200)
ON CONFLICT (plan, feature_key) DO NOTHING;
