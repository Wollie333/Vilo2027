-- Link every platform_ledger charge to its product_order, and heal the
-- multi-payment-method duplicate-charge bug.
--
-- THE BUG: a single product_order (one pay_token) could accumulate ONE pending
-- platform_ledger charge PER payment method the buyer touched — EFT seeds
-- `eft_<order>`, Paystack seeds `prod_<order>_<ts>`, PayPal seeds `<paypalId>`.
-- Each settle path only flips ITS OWN row to completed, so if a buyer clicked
-- "Pay with EFT" (pending charge seeded) and then actually paid by card/PayPal,
-- the abandoned EFT charge stayed `pending` forever — showing as "outstanding
-- R499" next to the real "received R499" on the same order.
--
-- Until now a ledger row was linked to its order only by a naming convention on
-- provider_reference, and PayPal's reference does not embed the order id — so
-- sibling charges could not be found reliably across every method combo. This
-- adds a real FK so reconciliation is exact for ALL processors.

-- 1) The link column.
ALTER TABLE platform_ledger
  ADD COLUMN IF NOT EXISTS order_id uuid
    REFERENCES product_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS platform_ledger_order_id_idx
  ON platform_ledger(order_id);

-- 2) Backfill the link for existing charges.
--    a) EFT + Paystack rows encode the order id in the reference.
UPDATE platform_ledger l
SET order_id = o.id
FROM product_orders o
WHERE l.order_id IS NULL
  AND (
    l.provider_reference = 'eft_' || o.id::text
    OR l.provider_reference LIKE 'prod_' || o.id::text || '\_%'
  );

--    b) Any remaining row whose reference matches the order's stored reference
--       (covers PayPal, whose reference is the PayPal order id).
UPDATE platform_ledger l
SET order_id = o.id
FROM product_orders o
WHERE l.order_id IS NULL
  AND o.provider_reference IS NOT NULL
  AND o.provider_reference = l.provider_reference;

-- 3) Heal existing leaked rows: a PAID order can never have an outstanding
--    charge — its other methods were abandoned. Void every pending charge that
--    belongs to a paid order (→ 'failed', so it drops off the owed balance and
--    the outstanding KPI but stays in the ledger as an auditable trail).
UPDATE platform_ledger l
SET status = 'failed',
    reason = 'Superseded — order paid via another method'
FROM product_orders o
WHERE l.order_id = o.id
  AND o.status = 'paid'
  AND l.type = 'charge'
  AND l.status = 'pending';
