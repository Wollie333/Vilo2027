-- Migration: "run continuously" (evergreen) specials
--
-- An evergreen special is an always-on flexible deal with NO window end and NO
-- book-by deadline. Guests can book any future dates within the min/max-nights
-- bounds; expire_specials() never touches it (its window_end + book_by are null,
-- so that function's date guards evaluate false).

ALTER TABLE specials
  ADD COLUMN IF NOT EXISTS is_evergreen boolean NOT NULL DEFAULT false;

-- Relax the flexible-window constraint: an evergreen deal may omit window_end
-- (a fixed-window flexible deal still requires window_end > window_start).
ALTER TABLE specials DROP CONSTRAINT IF EXISTS special_flexible_window;
ALTER TABLE specials ADD CONSTRAINT special_flexible_window CHECK (
  date_mode <> 'flexible'
  OR (
    window_start IS NOT NULL
    AND min_nights IS NOT NULL AND min_nights >= 1
    AND (max_nights IS NULL OR max_nights >= min_nights)
    AND (
      is_evergreen
      OR (window_end IS NOT NULL AND window_end > window_start)
    )
  )
);

-- Evergreen only makes sense for a flexible deal, and must never carry an
-- end date or a booking deadline.
ALTER TABLE specials DROP CONSTRAINT IF EXISTS special_evergreen_shape;
ALTER TABLE specials ADD CONSTRAINT special_evergreen_shape CHECK (
  NOT is_evergreen
  OR (date_mode = 'flexible' AND window_end IS NULL AND book_by IS NULL)
);

COMMENT ON COLUMN specials.is_evergreen IS
  'Always-on flexible deal: no window_end, no book_by, never auto-expires.';
