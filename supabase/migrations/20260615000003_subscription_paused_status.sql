-- Migration: allow a 'paused' (on-hold) subscription status
--
-- Lets the super admin place a host's subscription on hold manually. Additive —
-- existing statuses unchanged. Like other non-active statuses, paused subs get no
-- plan features (check_feature_permission only counts trialing/active).

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status %'
  LOOP
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing','active','past_due','restricted','paused','cancelled','expired'));
