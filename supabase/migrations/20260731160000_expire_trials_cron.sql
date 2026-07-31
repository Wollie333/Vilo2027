-- Nightly trial-expiry sweep (competition host free-trials).
--
-- A host who signs up through a partner link during an active competition is put
-- on a `trialing` subscription whose `trial_ends_at` is set from the campaign's
-- host_trial config: max(cohort_end, activation + floor_days) — Founding
-- Programme doc §5.2–5.3. Nothing else transitions a subscription OUT of
-- `trialing`, so without this job the free access would never end.
--
-- When the trial lapses we move the sub to `restricted` — read-only, per doc
-- §5.3 ("accounts go read-only with full data export available"), the same
-- status the `restrict-overdue-subscriptions` job uses. The feature gate
-- (`check_feature_permission` counts only status IN ('trialing','active')) then
-- denies paid features until the host upgrades and pays via the dashboard
-- "Buy immediately" flow.

SELECT cron.unschedule('expire-trials')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-trials');

-- 02:15 UTC (~04:15 SA) — off-peak; a trial ends on a day boundary so once daily
-- is ample. Idempotent: a second run the same day matches no rows.
SELECT cron.schedule('expire-trials', '15 2 * * *', $cron$
  UPDATE public.subscriptions
     SET status = 'restricted', updated_at = now()
   WHERE status = 'trialing'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < now();
$cron$);
