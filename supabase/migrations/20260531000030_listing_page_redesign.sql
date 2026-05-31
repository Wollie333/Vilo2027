-- Migration: public listing-page redesign support
--
-- Adds the data behind the reworked guest listing page (Listing Page design):
--   1. Combo discounts on listings (whole-place + length-of-stay), applied
--      server-side in createBookingAction.
--   2. listing_points_of_interest — host-curated "Where you'll be" cards
--      (Eat / Do / Travel with travel times).
--   3. reviews.trip_type + reviews.helpful_count, plus review_helpful_votes
--      (one vote per user, denormalised count kept in sync by trigger).
--   4. listing_review_themes — host-curated "Guests mention" chips.
--   5. Feature-gate seeds (open on every plan for the pre-MVP founder test).
--
-- Pre-MVP (CLAUDE.md): additive + safe on an empty DB. Discounts are nullable
-- (NULL / 0 = no discount), so existing listings are unaffected.
--
-- DOWN:
--   ALTER TABLE public.listings
--     DROP COLUMN whole_listing_discount_pct, DROP COLUMN weekly_discount_pct,
--     DROP COLUMN monthly_discount_pct;
--   ALTER TABLE public.reviews
--     DROP COLUMN trip_type, DROP COLUMN helpful_count;
--   DROP TABLE public.review_helpful_votes;
--   DROP TABLE public.listing_points_of_interest;
--   DROP TABLE public.listing_review_themes;

-- ─── 1. Combo discounts on listings ──────────────────────────────
-- whole_listing_discount_pct: % off the rooms subtotal when a guest books
--   every active room together (or scope = whole_listing).
-- weekly/monthly_discount_pct: length-of-stay % off (≥ 7 / ≥ 28 nights).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS whole_listing_discount_pct numeric
    CHECK (whole_listing_discount_pct IS NULL
           OR (whole_listing_discount_pct >= 0 AND whole_listing_discount_pct <= 90)),
  ADD COLUMN IF NOT EXISTS weekly_discount_pct numeric
    CHECK (weekly_discount_pct IS NULL
           OR (weekly_discount_pct >= 0 AND weekly_discount_pct <= 90)),
  ADD COLUMN IF NOT EXISTS monthly_discount_pct numeric
    CHECK (monthly_discount_pct IS NULL
           OR (monthly_discount_pct >= 0 AND monthly_discount_pct <= 90));

COMMENT ON COLUMN public.listings.whole_listing_discount_pct IS
  '% off the rooms subtotal when every active room is booked together (or scope = whole_listing). NULL/0 = none.';
COMMENT ON COLUMN public.listings.weekly_discount_pct IS
  'Length-of-stay % off for stays of 7+ nights. Applied after the whole-listing discount. NULL/0 = none.';
COMMENT ON COLUMN public.listings.monthly_discount_pct IS
  'Length-of-stay % off for stays of 28+ nights (supersedes weekly when both qualify). NULL/0 = none.';

-- ─── 2. listing_points_of_interest ───────────────────────────────
CREATE TABLE public.listing_points_of_interest (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  category    text        NOT NULL CHECK (category IN ('eat', 'do', 'travel')),
  name        text        NOT NULL,
  travel_time text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_listing ON listing_points_of_interest (listing_id, category, sort_order);

ALTER TABLE listing_points_of_interest ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE listing_points_of_interest IS
  'Host-curated "Where you''ll be" entries grouped by Eat / Do / Travel with optional travel time.';

CREATE POLICY "public_read_poi" ON listing_points_of_interest FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
CREATE POLICY "host_manage_poi" ON listing_points_of_interest FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()))
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_poi" ON listing_points_of_interest FOR ALL
  USING (is_super_admin());

-- ─── 3. reviews: trip_type + helpful_count + votes ───────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS trip_type text
    CHECK (trip_type IS NULL OR trip_type IN
      ('couples', 'family', 'solo', 'friends', 'business', 'other')),
  ADD COLUMN IF NOT EXISTS helpful_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.reviews.trip_type IS
  'Optional guest-selected trip type, used for the review filter pills (Couples / Family / Solo …).';
COMMENT ON COLUMN public.reviews.helpful_count IS
  'Denormalised count of review_helpful_votes, kept in sync by trigger.';

CREATE TABLE public.review_helpful_votes (
  review_id  uuid        NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX idx_review_votes_user ON review_helpful_votes (user_id);

ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE review_helpful_votes IS
  'One "helpful" vote per signed-in user per review. reviews.helpful_count is the denormalised total.';

-- Anyone signed in can see/cast/retract their own vote; the public reads the
-- denormalised count on reviews, not these rows.
CREATE POLICY "user_read_own_votes" ON review_helpful_votes FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "user_insert_own_vote" ON review_helpful_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_delete_own_vote" ON review_helpful_votes FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY "admin_full_review_votes" ON review_helpful_votes FOR ALL
  USING (is_super_admin());

CREATE OR REPLACE FUNCTION sync_review_helpful_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_review_helpful_count
  AFTER INSERT OR DELETE ON review_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION sync_review_helpful_count();

-- ─── 4. listing_review_themes ("Guests mention") ─────────────────
CREATE TABLE public.listing_review_themes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  label         text        NOT NULL,
  icon_key      text        NOT NULL DEFAULT 'sparkles',
  mention_count integer,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_themes_listing ON listing_review_themes (listing_id, sort_order);

ALTER TABLE listing_review_themes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE listing_review_themes IS
  'Host-curated "Guests mention" chips (label + lucide icon_key + optional count). May later be auto-derived from review text.';

CREATE POLICY "public_read_review_themes" ON listing_review_themes FOR SELECT
  USING (listing_id IN (SELECT id FROM listings WHERE is_published = true));
CREATE POLICY "host_manage_review_themes" ON listing_review_themes FOR ALL
  USING (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()))
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE host_id = get_my_host_id()));
CREATE POLICY "admin_full_review_themes" ON listing_review_themes FOR ALL
  USING (is_super_admin());

-- ─── 5. Feature gates (open on every plan, pre-MVP) ──────────────
INSERT INTO plan_features (plan, feature_key, is_enabled, limit_value, description) VALUES
  ('free',     'combo_discounts', true, null, 'Whole-listing + length-of-stay discounts'),
  ('basic',    'combo_discounts', true, null, 'Whole-listing + length-of-stay discounts'),
  ('pro',      'combo_discounts', true, null, 'Whole-listing + length-of-stay discounts'),
  ('business', 'combo_discounts', true, null, 'Whole-listing + length-of-stay discounts'),
  ('free',     'neighbourhood',   true, null, 'Where you''ll be — points of interest'),
  ('basic',    'neighbourhood',   true, null, 'Where you''ll be — points of interest'),
  ('pro',      'neighbourhood',   true, null, 'Where you''ll be — points of interest'),
  ('business', 'neighbourhood',   true, null, 'Where you''ll be — points of interest'),
  ('free',     'review_themes',   true, null, 'Guests-mention review chips'),
  ('basic',    'review_themes',   true, null, 'Guests-mention review chips'),
  ('pro',      'review_themes',   true, null, 'Guests-mention review chips'),
  ('business', 'review_themes',   true, null, 'Guests-mention review chips')
ON CONFLICT (plan, feature_key) DO UPDATE
  SET is_enabled  = EXCLUDED.is_enabled,
      limit_value = EXCLUDED.limit_value,
      description = EXCLUDED.description;
