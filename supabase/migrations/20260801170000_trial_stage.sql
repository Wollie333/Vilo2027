-- Pipeline → Meta CAPI — Phase 3a: Trial stage + is_customer flag.
--
-- Adds a host pipeline stage 'Trial' (for a host who signed up and is on a free
-- trial — technically a customer, not yet paying) between Nurturing and Won, and
-- an is_customer flag on stages that mean "this lead is a customer" (Trial +
-- every Won stage). is_customer drives the customer-lock (a card in a customer
-- stage can't be deleted) and is set on future customer stages by the same flag.
--
-- The board renders stages straight from pipeline_stages (ordered by sort_order),
-- so the new column appears automatically. The subscription-trialing trigger that
-- auto-moves a host card into this stage lands in the next migration.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   DELETE FROM pipeline_stages WHERE audience='host' AND key='trial';
--   UPDATE pipeline_stages SET sort_order=5 WHERE audience='host' AND key='won';
--   UPDATE pipeline_stages SET sort_order=6 WHERE audience='host' AND key='lost';
--   ALTER TABLE pipeline_stages DROP COLUMN is_customer;

-- ─── 1. is_customer flag ──────────────────────────────────────────────
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS is_customer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipeline_stages.is_customer IS
  'True when a lead in this stage is a customer (Trial or Won) — card is locked against deletion.';

-- Every Won stage (host + affiliate) is a customer stage.
UPDATE public.pipeline_stages SET is_customer = true WHERE is_won = true;

-- ─── 2. Make room + insert the host Trial stage ───────────────────────
-- Shift Won (5→6) and Lost (6→7) up by one, highest first to dodge the
-- UNIQUE(audience, sort_order)… (no such constraint exists, but ordering the
-- updates keeps intent obvious).
UPDATE public.pipeline_stages SET sort_order = 7 WHERE audience = 'host' AND key = 'lost';
UPDATE public.pipeline_stages SET sort_order = 6 WHERE audience = 'host' AND key = 'won';

INSERT INTO public.pipeline_stages (audience, key, label, sort_order, is_won, is_lost, is_customer)
VALUES ('host', 'trial', 'Trial', 5, false, false, true)
ON CONFLICT (audience, key) DO NOTHING;
