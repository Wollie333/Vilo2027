-- Pipeline → Meta Conversions API — Phase 1: outbox table + drain cron.
--
-- Server-side Meta events (Subscribe / Purchase / StartTrial / QualifiedLead /
-- CompleteRegistration) are ENQUEUED here by DB triggers + server actions, then
-- drained by /api/meta-capi-worker (which hashes PII + POSTs to Meta). One row =
-- one event; `event_id` is UNIQUE = Meta dedup key AND our exactly-once latch
-- (every enqueue uses ON CONFLICT (event_id) DO NOTHING).
--
-- Worker URL lives in Vault as 'meta_capi_worker_url'; the bearer REUSES the
-- shared 'email_worker_secret' (same as the nurture / review workers). Create
-- once per env in the SQL Editor:
--
--   SELECT vault.create_secret(
--     'https://vilo2027.vercel.app/api/meta-capi-worker',
--     'meta_capi_worker_url', '');
--
-- Missing secrets → the cron tick is a fail-soft no-op (NOTICE logged). Missing
-- Meta CAPI creds (platform_integrations) → the worker marks rows 'skipped'.
-- Safe to apply before either exists.
--
-- ── DOWN ──────────────────────────────────────────────────────────────
--   SELECT cron.unschedule('drain-meta-capi');
--   DROP TABLE IF EXISTS public.meta_conversion_events;

-- ─── 1. Outbox table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_conversion_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name   text NOT NULL,
  -- Who converted (→ user_profiles for hashed em/ph/fn/ln + external_id).
  user_id      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  -- The CRM card, when one exists (→ marketing_consent for POPIA gating).
  lead_id      uuid REFERENCES public.pipeline_leads(id) ON DELETE SET NULL,
  value        numeric,          -- real ZAR for Subscribe/Purchase; null otherwise
  currency     text,
  content_ids  text[] NOT NULL DEFAULT '{}',
  content_name text,
  -- Meta dedup key AND our idempotency latch (ledger id / sub id / affiliate id /
  -- 'lead:<id>:QualifiedLead'). One event per key, ever.
  event_id     text NOT NULL UNIQUE,
  source_ref   text,             -- provenance (e.g. the platform_ledger row id)
  action_source text NOT NULL DEFAULT 'system_generated',
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts     int  NOT NULL DEFAULT 0,
  last_error   text,
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);

COMMENT ON TABLE public.meta_conversion_events IS
  'Outbox for server-side Meta Conversions API events. Enqueued by triggers/actions, drained by /api/meta-capi-worker. event_id UNIQUE = exactly-once.';

-- Worker scan: the pending queue, oldest first.
CREATE INDEX IF NOT EXISTS meta_conversion_events_pending_idx
  ON public.meta_conversion_events (created_at)
  WHERE status = 'pending';

-- Service-role only (worker + triggers). No client access.
ALTER TABLE public.meta_conversion_events ENABLE ROW LEVEL SECURITY;

-- ─── 2. drain-meta-capi cron (every minute) ───────────────────────────
SELECT cron.unschedule('drain-meta-capi')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-meta-capi');

SELECT cron.schedule('drain-meta-capi', '* * * * *', $cron$
  DO $body$
  DECLARE
    v_url     text;
    v_secret  text;
    v_pending int;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'meta_capi_worker_url' LIMIT 1;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'email_worker_secret' LIMIT 1;

    IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
      RAISE NOTICE 'drain-meta-capi: vault meta_capi_worker_url / email_worker_secret unset — skipping';
      RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pending
    FROM public.meta_conversion_events
    WHERE status = 'pending' AND attempts < 5;

    IF v_pending = 0 THEN RETURN; END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  END;
  $body$;
$cron$);
