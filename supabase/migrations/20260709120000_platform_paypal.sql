-- Platform (Wielo) PayPal credentials for product/subscription pay flows.
-- Mirrors how a host connects PayPal (host_payment_gateways: client id +
-- encrypted secret + environment + enabled), but for Wielo's OWN account on the
-- singleton platform_payment_settings row. The secret is stored via
-- lib/crypto/payments.encryptSecret (AES-256-GCM, or plaintext passthrough when
-- PAYMENT_CIPHER_KEY is unset) and decrypted only server-side. PayPal is the
-- international rail: product orders are charged in USD (converted from ZAR),
-- the ledger stays in ZAR.

alter table platform_payment_settings
  add column if not exists paypal_enabled boolean not null default false,
  add column if not exists paypal_environment text not null default 'test',
  add column if not exists paypal_client_id text,
  add column if not exists paypal_secret_cipher text;

alter table platform_payment_settings
  drop constraint if exists platform_payment_settings_paypal_env_chk;
alter table platform_payment_settings
  add constraint platform_payment_settings_paypal_env_chk
  check (paypal_environment in ('test', 'live'));
