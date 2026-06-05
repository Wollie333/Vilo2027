-- Analytics: Schema additions for channel tracking and guest demographics
-- Part of enterprise analytics system (Phase 1)

-- Add channel source to bookings (for channel mix analysis)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'direct'
    CHECK (channel IN ('direct','airbnb','booking','expedia','other'));

CREATE INDEX IF NOT EXISTS idx_bookings_channel ON bookings(channel) WHERE channel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_created_listing ON bookings(listing_id, created_at);

COMMENT ON COLUMN bookings.channel IS 'Booking source channel for revenue attribution (direct, airbnb, booking.com, expedia, other). Default "direct" until iCal sync auto-detection ships.';

-- Add country to user profiles (for guest demographics)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS country text;

CREATE INDEX IF NOT EXISTS idx_user_profiles_country ON user_profiles(country) WHERE country IS NOT NULL;

COMMENT ON COLUMN user_profiles.country IS 'ISO 3166-1 alpha-2 country code (ZA, GB, US, etc.) - inferred from IP on first visit or self-reported during booking';

-- Add index for conversation funnel analysis
CREATE INDEX IF NOT EXISTS idx_conversations_created_listing ON conversations(listing_id, created_at);

COMMENT ON INDEX idx_conversations_created_listing IS 'Supports conversion funnel query (views → inquiries → quotes → bookings)';
