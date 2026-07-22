-- A durable record of every webhook Paystack actually delivers.
--
-- Why this exists: on 2026-07-22 the paystack-webhook function was found to have
-- NEVER fired (deployed with verify_jwt on, so the edge gateway rejected every
-- request Paystack could make). Fixing it was easy. PROVING it now works turned
-- out to be impossible from the database:
--
--   * the webhook is an idempotent BACKSTOP — the pay-page return is the primary
--     settle path, and both write identical state (status='paid', paid_at,
--     method='paystack'), so whichever loses the compare-and-set exits SILENTLY;
--   * payments.provider_response only helps when a `payments` row exists, which
--     a product order does not have;
--   * only the webhook sets product_orders.status='failed', but Paystack does
--     not reliably emit charge.failed for a declined test card.
--
-- So a working webhook and a completely dead one looked identical. That is the
-- silent no-op pattern (RULES.md §8.1) — "if this were broken, what would I
-- see?" had the answer "nothing". This table is the answer: one row per
-- delivery, written before any business logic, so delivery is observable
-- independently of whether the handler had anything left to do.
--
-- Query it with:
--   SELECT received_at, event_type, outcome, reference
--   FROM webhook_deliveries ORDER BY received_at DESC LIMIT 20;

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL DEFAULT 'paystack',
  event_type   text,
  reference    text,
  environment  text,
  -- 'received' is written up front; the handler overwrites it with what it
  -- actually did. An outcome stuck on 'received' means the handler threw —
  -- itself worth seeing.
  outcome      text NOT NULL DEFAULT 'received',
  payload      jsonb,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_received_idx
  ON public.webhook_deliveries (provider, received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_reference_idx
  ON public.webhook_deliveries (reference);

-- Locked down: RLS on with NO policies, so anon and authenticated can read and
-- write nothing. service_role bypasses RLS, which is the only writer (the Edge
-- Function) and the only reader (admin tooling via the service client).
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.webhook_deliveries IS
  'One row per signature-VERIFIED webhook delivery. Deliberately does NOT log '
  'rejected deliveries: the endpoint is unauthenticated by necessity (the HMAC '
  'is the auth), so logging failures would let anyone grow this table at will. '
  'A rejected delivery shows up as a 401 in the provider dashboard instead.';
