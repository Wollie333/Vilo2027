-- WS-3b — data-backed changelog.
--
-- The public /change-log page renders the repo CHANGELOG.md (dev-facing). This
-- adds a curated, CUSTOMER-facing changelog stored in the DB so each entry can
-- CREDIT THE HOST who asked for the feature, by name, and a shipped Build Board
-- item can deep-link to its release. The file parse stays as the fallback when
-- no DB entries are published (see app/[locale]/change-log/page.tsx).
--
-- Mirrors the legal_documents pipeline: HTML sanitised on write AND read; public
-- reads published rows; writes are service_role-only (admin actions).

CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body_html text,
  -- Credit the host who asked. host_id is a soft link (SET NULL if the host is
  -- removed); credited_name is the display SNAPSHOT so the credit survives and
  -- renders without a join.
  credited_host_id uuid REFERENCES public.hosts(id) ON DELETE SET NULL,
  credited_name text,
  -- Optional deep-link to the shipped Build Board item this entry released.
  feature_request_id uuid REFERENCES public.feature_requests(id) ON DELETE SET NULL,
  shipped_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT changelog_entries_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT changelog_entries_title_len CHECK (char_length(title) BETWEEN 2 AND 160)
);

CREATE INDEX IF NOT EXISTS idx_changelog_entries_published
  ON public.changelog_entries (shipped_at DESC NULLS LAST, created_at DESC)
  WHERE is_published = true;

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.changelog_entries IS
  'Curated customer-facing changelog. Published rows are world-readable; writes are service_role-only (admin actions). credited_name snapshots the host credit for display.';

-- Published entries are public content — anyone may read them. No write policy,
-- so INSERT/UPDATE/DELETE are service_role-only.
DROP POLICY IF EXISTS "public reads published changelog" ON public.changelog_entries;
CREATE POLICY "public reads published changelog"
  ON public.changelog_entries FOR SELECT
  USING (is_published = true);

-- keep updated_at fresh on every write
CREATE OR REPLACE FUNCTION public.tg_changelog_entries_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_changelog_entries_touch ON public.changelog_entries;
CREATE TRIGGER trg_changelog_entries_touch
  BEFORE UPDATE ON public.changelog_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_changelog_entries_touch();

-- Audit target for changelog admin actions (see lib/admin/withAdminAudit.ts).
ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type = ANY (ARRAY[
    'host', 'guest', 'user', 'booking', 'listing', 'business', 'addon',
    'policy', 'review', 'subscription', 'plan', 'plan_feature',
    'platform_service', 'product', 'product_feature', 'platform_ledger',
    'platform_coupon',
    'feature_override', 'platform_setting', 'platform_staff', 'staff_member',
    'impersonation', 'permission_denied', 'help_article', 'help_video',
    'help_faq', 'help_category', 'help_status', 'help_settings',
    'help_article_suggestion', 'broadcast', 'notification_send',
    'listing_category', 'amenity_group', 'amenity_catalog', 'special_category',
    'affiliate', 'affiliate_payout', 'affiliate_settings', 'marketing_asset',
    'looking_for_requirement_group', 'looking_for_requirement_option',
    'feature_request', 'changelog_entry'
  ]));

-- Seed a few entries for genuinely-shipped features (published, NO fabricated
-- host credits — the founder attaches real credits in the editor). Gives the
-- /change-log page real content the moment it switches to DB mode.
INSERT INTO public.changelog_entries
  (slug, title, body_html, is_published, published_at, shipped_at)
VALUES
  ('seasonal-pricing-rules',
   'Seasonal pricing rules',
   '<p>Set higher rates for December, long weekends and peak season once — no more editing prices day by day. Seasonal rules stack correctly with specials and per-room base rates.</p>',
   true, now() - interval '9 days', now() - interval '9 days'),
  ('paypal-checkout',
   'PayPal checkout for guests',
   '<p>Guests can now pay with PayPal, not only a South African card — handy for international travellers booking your place direct.</p>',
   true, now() - interval '15 days', now() - interval '15 days'),
  ('direct-eft-payments',
   'Direct EFT payments',
   '<p>Accept manual EFT and confirm the booking the moment payment lands — zero card fees, money straight to your account.</p>',
   true, now() - interval '20 days', now() - interval '20 days')
ON CONFLICT (slug) DO NOTHING;
