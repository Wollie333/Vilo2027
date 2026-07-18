-- Model 2 — Flow B guardrail: Wielo's own revenue ledger is ZAR, always.
--
-- Wielo is a South African company; ZAR is its functional/reporting currency.
-- Subscriptions, credits and add-on products are recognised in ZAR even when the
-- host PAYS via PayPal in USD (USD is only a collection channel — see
-- lib/fx.convertZarToUsd + product-checkout). platform_ledger therefore must NEVER
-- hold a non-ZAR row; a host's Model-2 settlement currency (EUR/GBP/USD) must never
-- leak into Wielo's books.
--
-- The write sites already pass Wielo product/plan currencies (all ZAR), but they
-- pass a VARIABLE, so a mis-seeded non-ZAR Wielo product would silently corrupt
-- the revenue ledger. This CHECK makes the invariant explicit and fails closed:
-- such an insert errors loudly instead of writing a wrong-currency revenue row.
-- All existing rows are ZAR, so this applies cleanly.

ALTER TABLE public.platform_ledger
  ADD CONSTRAINT platform_ledger_currency_zar_only
  CHECK (currency = 'ZAR');
