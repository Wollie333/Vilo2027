-- Migration: Website CMS — first-party analytics (Phase 0A)
--
-- Powers the Overview tab's traffic dashboard with our OWN data (no third-party
-- pixel). A tiny cookieless beacon (`/api/site-track`, fired from the public
-- micro-site) inserts one row per pageview / booking-click. The Overview
-- aggregator (`lib/website/analytics.ts`) reads them back, scoped to the owner's
-- website via RLS.
--
-- INSERT-only: like admin_audit_log, rows are appended by the service role and
-- never updated or deleted by app code. Owner + super-admin may read; there is no
-- INSERT/UPDATE/DELETE policy (the beacon route uses the service-role client,
-- which bypasses RLS). Cookieless: `session_id` is a daily-rotating hash of
-- ip+ua+website computed server-side — never a stored identifier, so no consent
-- banner is required and no PII is retained.

CREATE TABLE IF NOT EXISTS public.website_analytics_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid NOT NULL REFERENCES public.host_websites(id) ON DELETE CASCADE,
  event         text NOT NULL DEFAULT 'pageview'
                  CHECK (event IN ('pageview','booking_click','outbound')),
  path          text NOT NULL DEFAULT '/',
  session_id    text,                 -- daily-rotating server-side hash; cookieless
  referrer_host text,                 -- e.g. 'google.com' (host only, never full URL)
  device        text CHECK (device IN ('desktop','mobile')),
  country       text,                 -- 2-letter code from edge header, when present
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.website_analytics_events IS
  'INSERT-only, cookieless website traffic events (pageview/booking_click/outbound) for the Overview traffic dashboard. Written by the /api/site-track beacon via the service role; owner + super-admin read only.';
COMMENT ON COLUMN public.website_analytics_events.session_id IS
  'Daily-rotating hash of ip+ua+website_id computed server-side. Not a persistent identifier; used only to count unique visitors per day.';

CREATE INDEX IF NOT EXISTS idx_website_analytics_site_time
  ON public.website_analytics_events(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_analytics_site_event
  ON public.website_analytics_events(website_id, event);
CREATE INDEX IF NOT EXISTS idx_website_analytics_site_path
  ON public.website_analytics_events(website_id, path);

ALTER TABLE public.website_analytics_events ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner + admin; inserts are service-role (bypass RLS). No
-- INSERT/UPDATE/DELETE policies → append-only for everyone but the service role.
CREATE POLICY website_analytics_owner_read ON public.website_analytics_events
  FOR SELECT TO authenticated
  USING (website_id IN (SELECT id FROM public.host_websites WHERE host_id = get_my_host_id()));
CREATE POLICY website_analytics_admin_read ON public.website_analytics_events
  FOR SELECT USING (is_super_admin());
