-- =============================================================================
-- Consolidate Looking-For metering onto ONE Wielo credit balance.
--
-- Founder (2026-07-16): "this is just way too complex … one simple credit system
-- and top up system … to see a looking for post detail = 1 credit, to quote =
-- 1 credit … deducts from their wielo credit balance, which never expires."
--
-- So: ONE wallet (`quote` — the Wielo Credits balance already shown in the host
-- header, sold by the credit packages, and displayed on the admin record), ONE
-- monthly allowance dial, priced per action. The separate `quote_request` wallet
-- and its second dial are gone.
--
-- Plan: docs/features/LOOKING_FOR_CREDIT_ALLOWANCES_PLAN.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. One dial. Replaces the two per-month keys from 20260716190000.
--    Numbers unchanged (free 0 / pro 50 / business 200) — they came from the
--    founder's own `looking_for_quotas.host_quotes_per_month` intent. Editable
--    per product in the product editor and per host in /admin/platform/features.
-- ---------------------------------------------------------------------------

INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value)
VALUES
  ('free',     'wielo_credits_per_month', TRUE, 0),
  ('pro',      'wielo_credits_per_month', TRUE, 50),
  ('business', 'wielo_credits_per_month', TRUE, 200)
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled = EXCLUDED.is_enabled,
      limit_value = EXCLUDED.limit_value;

-- The two-dial model never reached production use; drop the keys everywhere they
-- could have been set so no screen offers a number that nothing reads.
DELETE FROM plan_features
 WHERE feature_key IN (
   'looking_for_quote_requests_per_month',
   'looking_for_quote_responses_per_month'
 );
DELETE FROM product_features
 WHERE feature_key IN (
   'looking_for_quote_requests_per_month',
   'looking_for_quote_responses_per_month'
 );
DELETE FROM host_feature_overrides
 WHERE feature_key IN (
   'looking_for_quote_requests_per_month',
   'looking_for_quote_responses_per_month'
 );

-- ---------------------------------------------------------------------------
-- 2. Fold any `quote_request` balance into the single `quote` wallet, so nobody
--    loses credits that were granted or bought. Done through the ledger, never
--    by touching the wallet directly (AGENT_RULES §4.7): a debit to zero the old
--    wallet and a matching grant into the real one, both idempotent.
-- ---------------------------------------------------------------------------

-- ⚠️ The two calls MUST use different ref_ids. `apply_wielo_credit` dedupes on
-- (host_id, ref_type, ref_id, kind) and deliberately does NOT include `purpose`,
-- so sharing one ref would make the second call a silent no-op — the debit would
-- land, the matching grant would not, and the host's credits would simply
-- vanish. Caught in rehearsal doing exactly that (260 stayed 260 while 199 was
-- drained). Same trap as the per-purpose grants in 20260716190000.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT host_id, balance FROM wielo_credit_wallet
     WHERE purpose = 'quote_request' AND balance > 0
  LOOP
    PERFORM apply_wielo_credit(
      r.host_id, 'quote_request', -r.balance, 'adjustment',
      'Consolidated into the single Wielo credit balance',
      'consolidation', 'wielo_credits_v1:out:quote_request'
    );
    PERFORM apply_wielo_credit(
      r.host_id, 'quote', r.balance, 'adjustment',
      'Consolidated from lead credits',
      'consolidation', 'wielo_credits_v1:in:quote'
    );
  END LOOP;
END $$;

-- The emptied `quote_request` wallets are left in place rather than deleted: the
-- ledger is the audit trail and the rows are inert once nothing reads the
-- purpose. Historical `quote_request` ledger entries stay for the same reason.

-- ---------------------------------------------------------------------------
-- 3. Retire `looking_for_quotas` (was Phase 5).
--
--    Admin-editable since 20260628100000 and read by NOTHING — an admin could set
--    "Pro = 50 quotes/month" and it did nothing. Credits are now the single
--    source of truth for Looking-For metering, so the table and its admin route
--    go rather than sit there looking functional. `looking_for_usage` stays: it's
--    an append-only action log, not a limit.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS looking_for_quotas;
