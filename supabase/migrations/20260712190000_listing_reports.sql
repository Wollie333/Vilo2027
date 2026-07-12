-- Migration: Flagged Listings (F1) — guests report a public listing; admins
-- triage under Moderation → Flagged Listings.
--
-- Founder request 2026-07-12 (NEXT_STEPS §F1): the "Report this listing" button
-- on /property/[slug] opens a form (name, email, phone, reason, message). A row
-- lands here, admins are notified (admin_notifications via notifyAdmins), and
-- the report is triaged in the admin moderation area.
--
-- Reports are inserted server-side with the service-role client (anonymous
-- reporters allowed), so no public INSERT policy is needed — only admin/staff
-- read + manage.

CREATE TABLE public.listing_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  -- Snapshots so the queue reads cleanly even if the listing changes/goes away.
  listing_name    text,
  host_id         uuid REFERENCES hosts(id) ON DELETE SET NULL,

  -- Reporter (may be an anonymous guest).
  reporter_name   text NOT NULL,
  reporter_email  text NOT NULL,
  reporter_phone  text,

  reason          text NOT NULL CHECK (reason IN (
                    'scam','not_real','inappropriate','safety','spam','other'
                  )),
  message         text NOT NULL,

  status          text NOT NULL DEFAULT 'open' CHECK (status IN (
                    'open','reviewing','actioned','dismissed'
                  )),
  admin_note      text,
  reviewed_by     uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_reports_status     ON listing_reports(status);
CREATE INDEX idx_listing_reports_property   ON listing_reports(property_id);
CREATE INDEX idx_listing_reports_created_at ON listing_reports(created_at DESC);

ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

-- Admin/staff only (guests never read reports). Inserts happen via the
-- service-role client in the server action, which bypasses RLS.
CREATE POLICY "staff_read_listing_reports" ON listing_reports FOR SELECT
  USING (has_admin_permission('listings.moderate'));
CREATE POLICY "admin_full_listing_reports" ON listing_reports FOR ALL
  USING (is_super_admin());
