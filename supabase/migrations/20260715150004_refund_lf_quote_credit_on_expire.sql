-- Refund the quote-credit a host spent when their Looking-For quote lapses
-- UNACCEPTED (sent -> expired). The debit happens in TS (sendQuoteAction) so the
-- host can be blocked with a friendly message when out of credits; the refund is
-- a background side-effect that must fire wherever the status flips — including
-- the hourly expire-quotes pg_cron bulk UPDATE — so it lives in a trigger.
-- Idempotent: apply_wielo_credit dedupes the refund on (ref_type, ref_id, kind),
-- and we only refund when a matching debit was actually recorded for the quote.

create or replace function public.refund_lf_quote_credit_on_expire()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debit record;
begin
  if new.status = 'expired'
     and old.status = 'sent'
     and new.looking_for_post_id is not null
     and new.host_id is not null then
    -- Only refund if a credit was actually debited for this quote.
    select purpose, delta
      into v_debit
      from wielo_credit_ledger
      where ref_type = 'quote'
        and ref_id = new.id::text
        and kind = 'debit'
      order by created_at desc
      limit 1;
    if found then
      perform apply_wielo_credit(
        new.host_id,
        coalesce(v_debit.purpose, 'quote'),
        abs(v_debit.delta),
        'refund',
        'Quote expired unaccepted',
        'quote',
        new.id::text,
        null
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refund_lf_quote_credit_on_expire on public.quotes;
create trigger trg_refund_lf_quote_credit_on_expire
after update of status on public.quotes
for each row execute function public.refund_lf_quote_credit_on_expire();
