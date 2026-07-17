-- =============================================================================
-- PayPal could never buy a Wielo product — the CHECK forbade the method.
--
-- `product_orders.method` shipped as CHECK (method IN ('paystack','eft')) while
-- startProductPayPal() (lib/billing/product-checkout.ts) writes method='paypal'.
-- Every sibling table already allows the value — payments.method,
-- bookings.payment_method, refunds.refund_method, affiliate_payouts.method — so
-- this one CHECK simply never learned about the rail.
--
-- PROVEN on live (in a rollback txn): the UPDATE is rejected by
-- product_orders_method_check and `provider_reference` stays NULL. The app never
-- checked that error, so the failure was silent and the chain was:
--
--   startProductPayPal → PayPal order created (buyer CAN approve + pay)
--     → UPDATE {provider_reference, method:'paypal'} → REJECTED, ref stays NULL
--     → returns ok:true + approveUrl (error unchecked)  → buyer approves
--   capturePayPalProductOrder(orderId) → SELECT … WHERE provider_reference=orderId
--     → no row → "Order not found." → capture NEVER fires.
--
-- No money is lost (the lookup precedes the capture, so the authorization simply
-- expires) but a PayPal purchase can never complete, and it leaves an orphaned
-- pending platform_ledger row behind. Live and reachable, not theoretical:
-- paypal_enabled = true with a client_id set, and the active Starter membership
-- lists 'paypal' in payment_methods, so the Smart Buttons render.
--
-- The companion app fix checks the UPDATE error so a rejected write can never
-- again masquerade as a started checkout.
-- =============================================================================

ALTER TABLE public.product_orders
  DROP CONSTRAINT IF EXISTS product_orders_method_check;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_method_check
  CHECK (method IN ('paystack', 'paypal', 'eft'));

COMMENT ON COLUMN public.product_orders.method IS
  'Rail the buyer paid on: paystack (card) | paypal (international) | eft (manual). Null until a method is chosen.';
