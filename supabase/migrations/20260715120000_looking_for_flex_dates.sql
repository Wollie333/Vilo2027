-- =============================================================================
-- Looking-For — flexible travel dates
-- =============================================================================
-- Guests can say "these dates, but I can shift by ± N days". 0 = exact.
-- Hosts see the window so they can quote around availability.
-- -----------------------------------------------------------------------------

ALTER TABLE looking_for_posts
  ADD COLUMN IF NOT EXISTS date_flexibility_days INT NOT NULL DEFAULT 0
    CHECK (date_flexibility_days >= 0 AND date_flexibility_days <= 60);

COMMENT ON COLUMN looking_for_posts.date_flexibility_days IS
  'How many days either side of check_in/out the guest can flex. 0 = exact dates.';
