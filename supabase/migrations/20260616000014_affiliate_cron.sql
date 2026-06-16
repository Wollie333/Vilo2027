-- Migration: Affiliate program — clearing + clawback-backstop cron jobs.
--
-- clear-affiliate-commissions (hourly): flips pending → cleared once the refund
--   hold window (affiliate_settings.hold_days) has passed. The only place
--   pending → cleared happens. Cheap via idx_aff_comm_hold (partial index).
--
-- affiliate-clawback-backstop (daily): catches any refund that linked a charge
--   (reverses_ledger_id) but whose commission was not voided synchronously by the
--   trigger. Idempotent — re-running matches nothing once voided.

-- ─── clearing ────────────────────────────────────────────────────────────────
SELECT cron.unschedule('clear-affiliate-commissions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clear-affiliate-commissions');

SELECT cron.schedule('clear-affiliate-commissions', '7 * * * *', $cron$
  UPDATE public.affiliate_commissions
  SET status = 'cleared', cleared_at = now()
  WHERE status = 'pending' AND entry_type = 'accrual' AND hold_until <= now();
$cron$);

-- ─── clawback backstop ───────────────────────────────────────────────────────
SELECT cron.unschedule('affiliate-clawback-backstop')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'affiliate-clawback-backstop');

SELECT cron.schedule('affiliate-clawback-backstop', '23 2 * * *', $cron$
  DO $body$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT pl.id AS refund_id, pl.reverses_ledger_id AS charge_id
      FROM public.platform_ledger pl
      WHERE pl.type = 'refund' AND pl.reverses_ledger_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.affiliate_commissions ac
          WHERE ac.source_ledger_id = pl.reverses_ledger_id
            AND ac.entry_type = 'accrual'
            AND ac.status IN ('pending', 'cleared')
        )
    LOOP
      PERFORM public.clawback_affiliate_commission(r.charge_id, r.refund_id);
    END LOOP;
  END;
  $body$;
$cron$);
