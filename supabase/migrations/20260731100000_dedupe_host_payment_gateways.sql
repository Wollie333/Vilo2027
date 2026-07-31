-- A business ended up with TWO host_payment_gateways rows for the same gateway
-- (a re-connect inserted a second row): one held the real secret, the other was
-- empty. The readers/savers use `.maybeSingle()`, which ERRORS on multiple rows
-- and returns null — so the card rail silently dropped and every card payment for
-- that business failed, and each subsequent save inserted yet another duplicate.
--
-- Fix: collapse to one row per (business_id, gateway) — keep the row that
-- actually has a stored secret (then the newest) — and add a UNIQUE constraint so
-- a duplicate can never be created again. The app-side save is switched to an
-- idempotent upsert on this key.

delete from public.host_payment_gateways g
using (
  select
    id,
    row_number() over (
      partition by business_id, gateway
      order by
        (case
          when test_secret_cipher is not null
            or live_secret_cipher is not null
            or secret_cipher is not null then 0
          else 1
        end),
        created_at desc
    ) as rn
  from public.host_payment_gateways
) ranked
where g.id = ranked.id
  and ranked.rn > 1;

alter table public.host_payment_gateways
  add constraint host_payment_gateways_business_gateway_key
  unique (business_id, gateway);
