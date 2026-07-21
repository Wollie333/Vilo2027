-- WS-7 — platform funnel instrumentation.
--
-- website_analytics_events / special_view_events instrument the HOST's surfaces.
-- Nothing instruments WIELO's own funnel, so the launch plan's questions — what
-- fraction of Looking-For landing views start the wizard, which step loses them,
-- what a published request costs in ad spend — cannot be answered at all.
--
-- This is the same cookieless beacon shape as website_analytics_events: a
-- daily-rotating server-side session hash (ip+ua+funnel+UTC-day), device/country
-- derived server-side, NO PII and no cookies. Append-only; nothing here is ever
-- updated. Rows are platform-owned, so only super admins may read them.
--
-- The published→2-quotes-in-24h metric is deliberately NOT an event: it is
-- derived from looking_for_posts.created_at vs looking_for_responses.sent_at,
-- which are already the source of truth.

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which Wielo funnel. One table, many funnels (host signup comes later).
  funnel text NOT NULL DEFAULT 'looking_for',
  event text NOT NULL,
  -- For step events: which wizard step. NULL for the non-step events.
  step text,
  -- Cookieless daily-rotating hash; reproducible server-side so the publish
  -- event (recorded in the action, not the browser) joins the same session.
  session_id text,
  -- Set on the publish event only — lets a published request be traced back to
  -- its session, and its quote latency joined in.
  post_id uuid REFERENCES public.looking_for_posts(id) ON DELETE SET NULL,
  -- true when the funnel was walked by a signed-out lead (the ad-spend funnel).
  is_lead boolean,
  device text,
  country text,
  referrer_host text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funnel_events_event_check CHECK (event = ANY (ARRAY[
    'landing_view',    -- /looking-for/start rendered
    'wizard_start',    -- the request wizard mounted
    'step_complete',   -- a wizard step was left going forward (see step)
    'review_reached',  -- the review/preview step was reached
    'account_created', -- a lead identity was minted at publish
    'published'        -- the request went live
  ])),
  CONSTRAINT funnel_events_device_check
    CHECK (device IS NULL OR device = ANY (ARRAY['desktop', 'mobile']))
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel_created
  ON public.funnel_events (funnel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event
  ON public.funnel_events (funnel, event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session
  ON public.funnel_events (session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.funnel_events IS
  'Append-only, cookieless instrumentation of Wielo-owned funnels (WS-7). No PII: session_id is a daily-rotating ip+ua hash. Super admins read; writes are service_role-only.';

-- Platform-owned telemetry: super admins only. No write policy → the beacon
-- route and server actions insert via the service role.
DROP POLICY IF EXISTS "funnel_events_admin_read" ON public.funnel_events;
CREATE POLICY "funnel_events_admin_read"
  ON public.funnel_events FOR SELECT
  USING (public.is_super_admin());
