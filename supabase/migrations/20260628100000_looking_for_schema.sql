-- =============================================================================
-- Looking For Feature — Core Schema
-- =============================================================================
-- Guest-side "reverse marketplace" where guests post accommodation requests
-- and hosts respond with quotes via the existing quote system.
--
-- Follows Principle #5 (One Source of Truth):
--   - Uses existing quotes table (via FK) instead of duplicating quote data
--   - Uses existing conversations table for threads
--   - Uses existing user_profiles for guest identity
--   - Uses existing hosts table for host identity
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CORE TABLE: looking_for_posts (guest requests)
-- -----------------------------------------------------------------------------

CREATE TABLE looking_for_posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id              UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Request details
  title                 TEXT NOT NULL CHECK (char_length(title) <= 100),
  description           TEXT CHECK (char_length(description) <= 2000),
  category              TEXT NOT NULL DEFAULT 'accommodation'
                          CHECK (category IN ('accommodation', 'experience', 'venue', 'event', 'other')),
  sub_category          TEXT,

  -- Travel details
  check_in_date         DATE,
  check_out_date        DATE,
  adults                INT NOT NULL DEFAULT 1 CHECK (adults >= 1),
  children              INT NOT NULL DEFAULT 0 CHECK (children >= 0),
  infants               INT NOT NULL DEFAULT 0 CHECK (infants >= 0),

  -- Location (text + optional coordinates for geo-sorting)
  location_text         TEXT,
  location_region       TEXT,
  location_lat          DECIMAL(9,6),
  location_lng          DECIMAL(9,6),

  -- Budget
  budget_min            DECIMAL(10,2),
  budget_max            DECIMAL(10,2),
  budget_currency       TEXT NOT NULL DEFAULT 'ZAR',
  budget_per            TEXT DEFAULT 'night' CHECK (budget_per IN ('night', 'person', 'total')),

  -- Status & visibility
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'fulfilled', 'expired', 'removed', 'quotes_closed')),
  is_public             BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at            TIMESTAMPTZ,

  -- Metrics (denormalized for performance)
  view_count            INT NOT NULL DEFAULT 0,
  quote_count           INT NOT NULL DEFAULT 0,

  -- Enhancement fields (§17)
  is_urgent             BOOLEAN NOT NULL DEFAULT FALSE,
  urgent_until          TIMESTAMPTZ,
  min_host_rating       DECIMAL(2,1) CHECK (min_host_rating IS NULL OR min_host_rating BETWEEN 1.0 AND 5.0),
  quote_deadline        TIMESTAMPTZ,
  fulfilled_via         TEXT CHECK (fulfilled_via IN ('vilo_booking', 'ota', 'direct', 'other')),
  fulfilled_booking_id  UUID REFERENCES bookings(id),
  extension_count       INT NOT NULL DEFAULT 0,
  reopen_count          INT NOT NULL DEFAULT 0,

  -- Event/group fields (A8)
  event_type            TEXT CHECK (event_type IN ('wedding', 'corporate', 'tour_group', 'family_reunion', 'other')),
  total_headcount       INT CHECK (total_headcount IS NULL OR total_headcount >= 1),
  vendor_needs          TEXT[],
  is_all_in_quote       BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lfp_guest ON looking_for_posts(guest_id);
CREATE INDEX idx_lfp_status_active ON looking_for_posts(status) WHERE status = 'active';
CREATE INDEX idx_lfp_region ON looking_for_posts(location_region) WHERE location_region IS NOT NULL;
CREATE INDEX idx_lfp_dates ON looking_for_posts(check_in_date, check_out_date);
CREATE INDEX idx_lfp_created ON looking_for_posts(created_at DESC);
CREATE INDEX idx_lfp_expires ON looking_for_posts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_lfp_category ON looking_for_posts(category);
CREATE INDEX idx_lfp_urgent ON looking_for_posts(is_urgent, urgent_until) WHERE is_urgent = TRUE;

-- Updated_at trigger
CREATE TRIGGER looking_for_posts_updated_at
  BEFORE UPDATE ON looking_for_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------------
-- 2. RESPONSES TABLE: links posts to existing quotes
-- -----------------------------------------------------------------------------

CREATE TABLE looking_for_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  quote_id    UUID REFERENCES quotes(id),
  thread_id   UUID REFERENCES conversations(id),

  status      TEXT NOT NULL DEFAULT 'sent'
                CHECK (status IN ('sent', 'viewed', 'accepted', 'declined', 'expired')),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,

  UNIQUE(post_id, host_id)  -- One response per host per post
);

CREATE INDEX idx_lfr_post ON looking_for_responses(post_id);
CREATE INDEX idx_lfr_host ON looking_for_responses(host_id);
CREATE INDEX idx_lfr_quote ON looking_for_responses(quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX idx_lfr_status ON looking_for_responses(status);

-- -----------------------------------------------------------------------------
-- 3. QUOTAS TABLE: admin-configurable limits per plan
-- -----------------------------------------------------------------------------

CREATE TABLE looking_for_quotas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                 TEXT NOT NULL UNIQUE,

  -- Guest posting limits (NULL = unlimited)
  guest_posts_per_day     INT,
  guest_posts_per_month   INT,
  guest_posts_per_year    INT,
  guest_extensions_per_month INT DEFAULT 2,

  -- Host quoting limits (NULL = unlimited)
  host_quotes_per_day     INT,
  host_quotes_per_month   INT,
  host_quotes_per_year    INT,
  quote_expiry_days       INT DEFAULT 5,

  -- Display caps
  public_quote_count_cap  INT DEFAULT 5,

  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              UUID REFERENCES user_profiles(id)
);

-- Seed default quotas
INSERT INTO looking_for_quotas (plan_id, guest_posts_per_day, guest_posts_per_month, guest_posts_per_year, host_quotes_per_day, host_quotes_per_month, host_quotes_per_year) VALUES
  ('free',     1,    3,    12,   0,    0,     0),
  ('basic',    3,   10,    60,   3,   15,   100),
  ('pro',     10,   30,   200,  10,   50,   400),
  ('business', NULL, NULL, NULL, 30,  200,  NULL);

-- -----------------------------------------------------------------------------
-- 4. USAGE TABLE: lightweight action log for quota enforcement
-- -----------------------------------------------------------------------------

CREATE TABLE looking_for_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('guest_post', 'host_quote', 'guest_extension')),
  post_id     UUID REFERENCES looking_for_posts(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lfu_user_action ON looking_for_usage(user_id, action, occurred_at DESC);
CREATE INDEX idx_lfu_occurred ON looking_for_usage(occurred_at DESC);

-- -----------------------------------------------------------------------------
-- 5. VIEW TRACKING: distinct host views per post
-- -----------------------------------------------------------------------------

CREATE TABLE looking_for_post_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(post_id, host_id)  -- One view record per host per post
);

CREATE INDEX idx_lfpv_post ON looking_for_post_views(post_id);
CREATE INDEX idx_lfpv_host ON looking_for_post_views(host_id);

-- -----------------------------------------------------------------------------
-- 6. HOST ENHANCEMENTS: bookmarks, passes, alerts
-- -----------------------------------------------------------------------------

-- H8: Bookmarks (save for later)
CREATE TABLE looking_for_bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(host_id, post_id)
);

CREATE INDEX idx_lfb_host ON looking_for_bookmarks(host_id);

-- H2: "Not a Fit" passes
CREATE TABLE looking_for_passes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  reason      TEXT CHECK (reason IN ('dates_conflict', 'wrong_category', 'outside_capacity', 'budget_too_low', 'other')),
  passed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(host_id, post_id)
);

CREATE INDEX idx_lfpa_host ON looking_for_passes(host_id);

-- H1: Saved search alerts
CREATE TABLE looking_for_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  criteria_json JSONB NOT NULL,  -- { regions: [], categories: [], minGroupSize: N, maxGroupSize: N, budgetMin: N, budgetMax: N }
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_matched_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lfa_host_active ON looking_for_alerts(host_id) WHERE is_active = TRUE;

-- A2: Private/targeted requests
CREATE TABLE looking_for_post_targets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES looking_for_posts(id) ON DELETE CASCADE,
  host_id     UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(post_id, host_id)
);

CREATE INDEX idx_lfpt_post ON looking_for_post_targets(post_id);
CREATE INDEX idx_lfpt_host ON looking_for_post_targets(host_id);

-- -----------------------------------------------------------------------------
-- 7. EXTEND EXISTING QUOTES TABLE
-- -----------------------------------------------------------------------------

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS looking_for_post_id UUID REFERENCES looking_for_posts(id);
CREATE INDEX IF NOT EXISTS idx_quotes_lf_post ON quotes(looking_for_post_id) WHERE looking_for_post_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 8. ADD FEATURE FLAG TO plan_features
-- -----------------------------------------------------------------------------

INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value)
VALUES
  ('free',     'looking_for_access', false, null),
  ('basic',    'looking_for_access', true,  null),
  ('pro',      'looking_for_access', true,  null),
  ('business', 'looking_for_access', true,  null)
ON CONFLICT (plan, feature_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- -----------------------------------------------------------------------------
-- 9. RLS POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE looking_for_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_post_targets ENABLE ROW LEVEL SECURITY;

-- looking_for_posts: public read active, guests manage own
CREATE POLICY "Public can view active posts"
  ON looking_for_posts FOR SELECT
  USING (status = 'active' AND is_public = TRUE);

CREATE POLICY "Guests can view own posts"
  ON looking_for_posts FOR SELECT
  USING (guest_id = auth.uid());

CREATE POLICY "Guests can insert own posts"
  ON looking_for_posts FOR INSERT
  WITH CHECK (guest_id = auth.uid());

CREATE POLICY "Guests can update own posts"
  ON looking_for_posts FOR UPDATE
  USING (guest_id = auth.uid());

CREATE POLICY "Guests can delete own posts"
  ON looking_for_posts FOR DELETE
  USING (guest_id = auth.uid());

-- looking_for_responses: hosts manage own
CREATE POLICY "Hosts can view own responses"
  ON looking_for_responses FOR SELECT
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

CREATE POLICY "Hosts can insert own responses"
  ON looking_for_responses FOR INSERT
  WITH CHECK (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

CREATE POLICY "Guests can view responses to own posts"
  ON looking_for_responses FOR SELECT
  USING (post_id IN (SELECT id FROM looking_for_posts WHERE guest_id = auth.uid()));

-- looking_for_quotas: admin only
CREATE POLICY "Admins can manage quotas"
  ON looking_for_quotas FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- looking_for_usage: users see own usage
CREATE POLICY "Users can view own usage"
  ON looking_for_usage FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert usage"
  ON looking_for_usage FOR INSERT
  WITH CHECK (TRUE);  -- Controlled by service role

-- looking_for_post_views: hosts can insert, post owners can view
CREATE POLICY "Hosts can insert views"
  ON looking_for_post_views FOR INSERT
  WITH CHECK (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

CREATE POLICY "Post owners can view their post views"
  ON looking_for_post_views FOR SELECT
  USING (post_id IN (SELECT id FROM looking_for_posts WHERE guest_id = auth.uid()));

-- Bookmarks, passes, alerts: host ownership
CREATE POLICY "Hosts manage own bookmarks"
  ON looking_for_bookmarks FOR ALL
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

CREATE POLICY "Hosts manage own passes"
  ON looking_for_passes FOR ALL
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

CREATE POLICY "Hosts manage own alerts"
  ON looking_for_alerts FOR ALL
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

-- Post targets: visible to targeted hosts
CREATE POLICY "Targeted hosts can view their targets"
  ON looking_for_post_targets FOR SELECT
  USING (host_id IN (SELECT id FROM hosts WHERE user_id = auth.uid()));

CREATE POLICY "Post owners can manage targets"
  ON looking_for_post_targets FOR ALL
  USING (post_id IN (SELECT id FROM looking_for_posts WHERE guest_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- 10. QUOTA CHECK FUNCTIONS
-- -----------------------------------------------------------------------------

-- Check guest posting quota
CREATE OR REPLACE FUNCTION check_guest_post_quota(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_quotas RECORD;
  v_today_count INT;
  v_month_count INT;
  v_year_count INT;
  v_allowed BOOLEAN := TRUE;
  v_limit_hit TEXT := NULL;
BEGIN
  -- Get user's plan
  SELECT COALESCE(s.plan, 'free') INTO v_plan
  FROM subscriptions s
  JOIN hosts h ON h.id = s.host_id
  WHERE h.user_id = p_user_id
  LIMIT 1;

  -- If no host record, assume guest with free plan
  IF v_plan IS NULL THEN
    v_plan := 'free';
  END IF;

  -- Get quota limits
  SELECT * INTO v_quotas
  FROM looking_for_quotas
  WHERE plan_id = v_plan;

  IF NOT FOUND THEN
    SELECT * INTO v_quotas FROM looking_for_quotas WHERE plan_id = 'free';
  END IF;

  -- Count usage
  SELECT COUNT(*) INTO v_today_count
  FROM looking_for_usage
  WHERE user_id = p_user_id
    AND action = 'guest_post'
    AND occurred_at >= CURRENT_DATE;

  SELECT COUNT(*) INTO v_month_count
  FROM looking_for_usage
  WHERE user_id = p_user_id
    AND action = 'guest_post'
    AND occurred_at >= date_trunc('month', CURRENT_DATE);

  SELECT COUNT(*) INTO v_year_count
  FROM looking_for_usage
  WHERE user_id = p_user_id
    AND action = 'guest_post'
    AND occurred_at >= date_trunc('year', CURRENT_DATE);

  -- Check limits
  IF v_quotas.guest_posts_per_day IS NOT NULL AND v_today_count >= v_quotas.guest_posts_per_day THEN
    v_allowed := FALSE;
    v_limit_hit := 'day';
  ELSIF v_quotas.guest_posts_per_month IS NOT NULL AND v_month_count >= v_quotas.guest_posts_per_month THEN
    v_allowed := FALSE;
    v_limit_hit := 'month';
  ELSIF v_quotas.guest_posts_per_year IS NOT NULL AND v_year_count >= v_quotas.guest_posts_per_year THEN
    v_allowed := FALSE;
    v_limit_hit := 'year';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining_today', GREATEST(0, COALESCE(v_quotas.guest_posts_per_day, 999) - v_today_count),
    'remaining_month', GREATEST(0, COALESCE(v_quotas.guest_posts_per_month, 999) - v_month_count),
    'remaining_year', GREATEST(0, COALESCE(v_quotas.guest_posts_per_year, 999) - v_year_count),
    'limit_hit', v_limit_hit
  );
END;
$$;

-- Check host quoting quota
CREATE OR REPLACE FUNCTION check_host_quote_quota(p_host_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_plan TEXT;
  v_quotas RECORD;
  v_today_count INT;
  v_month_count INT;
  v_year_count INT;
  v_allowed BOOLEAN := TRUE;
  v_limit_hit TEXT := NULL;
BEGIN
  -- Get user_id from host
  SELECT user_id INTO v_user_id FROM hosts WHERE id = p_host_id;

  -- Get plan
  SELECT COALESCE(s.plan, 'free') INTO v_plan
  FROM subscriptions s
  WHERE s.host_id = p_host_id
  LIMIT 1;

  IF v_plan IS NULL THEN
    v_plan := 'free';
  END IF;

  -- Get quota limits
  SELECT * INTO v_quotas
  FROM looking_for_quotas
  WHERE plan_id = v_plan;

  IF NOT FOUND THEN
    SELECT * INTO v_quotas FROM looking_for_quotas WHERE plan_id = 'free';
  END IF;

  -- Count usage
  SELECT COUNT(*) INTO v_today_count
  FROM looking_for_usage
  WHERE user_id = v_user_id
    AND action = 'host_quote'
    AND occurred_at >= CURRENT_DATE;

  SELECT COUNT(*) INTO v_month_count
  FROM looking_for_usage
  WHERE user_id = v_user_id
    AND action = 'host_quote'
    AND occurred_at >= date_trunc('month', CURRENT_DATE);

  SELECT COUNT(*) INTO v_year_count
  FROM looking_for_usage
  WHERE user_id = v_user_id
    AND action = 'host_quote'
    AND occurred_at >= date_trunc('year', CURRENT_DATE);

  -- Check limits
  IF v_quotas.host_quotes_per_day IS NOT NULL AND v_today_count >= v_quotas.host_quotes_per_day THEN
    v_allowed := FALSE;
    v_limit_hit := 'day';
  ELSIF v_quotas.host_quotes_per_month IS NOT NULL AND v_month_count >= v_quotas.host_quotes_per_month THEN
    v_allowed := FALSE;
    v_limit_hit := 'month';
  ELSIF v_quotas.host_quotes_per_year IS NOT NULL AND v_year_count >= v_quotas.host_quotes_per_year THEN
    v_allowed := FALSE;
    v_limit_hit := 'year';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining_today', GREATEST(0, COALESCE(v_quotas.host_quotes_per_day, 999) - v_today_count),
    'remaining_month', GREATEST(0, COALESCE(v_quotas.host_quotes_per_month, 999) - v_month_count),
    'remaining_year', GREATEST(0, COALESCE(v_quotas.host_quotes_per_year, 999) - v_year_count),
    'limit_hit', v_limit_hit
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. AUTO-EXPIRY TRIGGER
-- -----------------------------------------------------------------------------

-- Set expires_at when post is created (default: 30 days or checkout date + 7 days)
CREATE OR REPLACE FUNCTION set_looking_for_post_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    IF NEW.check_out_date IS NOT NULL THEN
      NEW.expires_at := (NEW.check_out_date + INTERVAL '7 days')::TIMESTAMPTZ;
    ELSE
      NEW.expires_at := NOW() + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER looking_for_posts_set_expiry
  BEFORE INSERT ON looking_for_posts
  FOR EACH ROW EXECUTE FUNCTION set_looking_for_post_expiry();

-- Increment quote_count when response is created
CREATE OR REPLACE FUNCTION increment_looking_for_quote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE looking_for_posts
  SET quote_count = quote_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER looking_for_responses_increment_count
  AFTER INSERT ON looking_for_responses
  FOR EACH ROW EXECUTE FUNCTION increment_looking_for_quote_count();

-- Increment view_count on distinct host view
CREATE OR REPLACE FUNCTION increment_looking_for_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE looking_for_posts
  SET view_count = view_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER looking_for_views_increment_count
  AFTER INSERT ON looking_for_post_views
  FOR EACH ROW EXECUTE FUNCTION increment_looking_for_view_count();

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
