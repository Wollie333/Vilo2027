-- Migration: Specials — view tracking (S6b)
--
-- Cookieless conversion tracking for the public platform special-detail page
-- (`/special/[slug]`). A tiny beacon (`/api/special-track`, fired client-side)
-- inserts one row per detail-page view and one per Book-CTA click. The per-
-- special report panel (`lib/specials/reporting.ts → loadSpecialReport`) reads
-- them back to show Views / Unique viewers / Book clicks and a view→booking
-- conversion rate alongside the realised-booking funnel it already reports.
--
-- Mirrors `website_analytics_events` / `quote_view_events`: INSERT-only, append
-- by the service role (the beacon route uses the admin client, which bypasses
-- RLS). Cookieless — `session_id` is a daily-rotating server-side hash of
-- ip+ua+special+UTC-day; never a stored identifier, so no consent banner and no
-- PII is retained. Owner + super-admin read only; no INSERT/UPDATE/DELETE policy.
--
-- Pre-MVP data policy (CLAUDE.md): purely additive.

CREATE TABLE IF NOT EXISTS public.special_view_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  special_id    uuid        NOT NULL REFERENCES public.specials(id) ON DELETE CASCADE,
  event         text        NOT NULL DEFAULT 'special_view'
                  CHECK (event IN ('special_view','special_book_click')),
  session_id    text,                 -- daily-rotating server-side hash; cookieless
  referrer_host text,                 -- e.g. 'google.com' (host only, never full URL)
  device        text        CHECK (device IN ('desktop','mobile')),
  country       text,                 -- 2-letter code from edge header, when present
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.special_view_events IS
  'INSERT-only, cookieless special detail-page events (special_view/special_book_click) for the per-special report panel. Written by the /api/special-track beacon via the service role; owner + super-admin read only.';
COMMENT ON COLUMN public.special_view_events.session_id IS
  'Daily-rotating hash of ip+ua+special_id computed server-side. Not a persistent identifier; used only to count unique viewers per day.';

CREATE INDEX IF NOT EXISTS idx_special_view_events_special_time
  ON public.special_view_events(special_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_view_events_special_event
  ON public.special_view_events(special_id, event);

ALTER TABLE public.special_view_events ENABLE ROW LEVEL SECURITY;

-- Host reads view events for their own specials. Inserts come from the service
-- role on the public beacon route (bypasses RLS), so there is intentionally no
-- INSERT policy for anon/authenticated.
DROP POLICY IF EXISTS special_view_events_owner_read ON public.special_view_events;
CREATE POLICY special_view_events_owner_read ON public.special_view_events
  FOR SELECT TO authenticated
  USING (special_id IN (SELECT id FROM public.specials WHERE host_id = get_my_host_id()));

DROP POLICY IF EXISTS special_view_events_admin_read ON public.special_view_events;
CREATE POLICY special_view_events_admin_read ON public.special_view_events
  FOR SELECT USING (is_super_admin());
