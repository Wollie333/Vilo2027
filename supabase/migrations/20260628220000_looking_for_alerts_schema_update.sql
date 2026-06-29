-- Migration: Update looking_for_alerts schema
-- Aligns the table structure with the UI expectations

-- Drop the old criteria_json column and add individual filter columns
ALTER TABLE looking_for_alerts
  DROP COLUMN IF EXISTS criteria_json,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS location_region TEXT,
  ADD COLUMN IF NOT EXISTS min_budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS max_budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS min_guests INT,
  ADD COLUMN IF NOT EXISTS max_guests INT,
  ADD COLUMN IF NOT EXISTS check_in_from DATE,
  ADD COLUMN IF NOT EXISTS check_in_to DATE,
  ADD COLUMN IF NOT EXISTS match_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- Update the name column to be optional (for auto-generated names)
ALTER TABLE looking_for_alerts
  ALTER COLUMN name DROP NOT NULL;

COMMENT ON TABLE looking_for_alerts IS 'Saved search alerts for hosts to get notified of matching guest requests';
