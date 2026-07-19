-- Return a claimed coupon redemption when a booking unwinds — so an abandoned,
-- failed, or cancelled coupon booking never permanently consumes the coupon's
-- caps.
--
-- Two leaks this closes (the coupon analogue of release_special for specials):
--
--   1. ROLLBACK leak. redeem_coupon() runs right after the booking row is
--      inserted (before payment). If a LATER persist step fails, the booking
--      row is DELETED. coupon_redemptions cascades away with it (booking_id FK
--      ON DELETE CASCADE) — but `redeemed_count` is a SEPARATE counter the
--      cascade never touches, so it drifted UP with no matching ledger row and
--      the coupon hit max_redemptions early. (persist.ts omitted a rollback for
--      the coupon claim on the false premise that "the ledger cascades" — it
--      does, but the counter doesn't.)
--
--   2. CANCEL leak. on_booking_cancelled released blocked_dates + a special's
--      redemptions_used, but left the coupon consumed — a cancelled/declined/
--      expired/no_show coupon booking kept burning both the total cap AND the
--      per-guest cap (per_guest_limit counts ledger rows), locking the guest out
--      forever even though no stay ever completed.
--
-- release_coupon() is the atomic inverse of the ledger side of redeem_coupon():
-- delete this booking's redemption row (if present) and decrement redeemed_count
-- by exactly the number of rows removed. Idempotent — a second call (double
-- cancel, or cancel after the app already released on rollback) removes nothing
-- and decrements nothing. Deleting the ledger row also frees per_guest_limit.

-- ─── 1. release_coupon() — return a claimed redemption ───────────
CREATE OR REPLACE FUNCTION public.release_coupon(
  p_coupon_id  uuid,
  p_booking_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM coupon_redemptions
   WHERE coupon_id = p_coupon_id AND booking_id = p_booking_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE coupons
       SET redeemed_count = GREATEST(0, redeemed_count - v_deleted)
     WHERE id = p_coupon_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.release_coupon(uuid, uuid) IS
  'Atomic inverse of redeem_coupon: removes a booking''s coupon redemption row and decrements redeemed_count by the number removed. Idempotent. Frees the per-guest cap too. Called by the booking action''s rollback ladder (a bare DELETE does not fire on_booking_cancelled) and by on_booking_cancelled on terminal-status transitions.';

-- Service-role only — matches redeem_coupon (20260716310000). The sole app
-- caller is the booking action via the admin client; the cancel path calls it
-- from inside on_booking_cancelled (a SECURITY DEFINER trigger), unaffected by
-- these grants.
REVOKE ALL ON FUNCTION public.release_coupon(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_coupon(uuid, uuid) TO service_role;

-- ─── 2. on_booking_cancelled() — also return the coupon ──────────
-- Unchanged except the new coupon-release block (mirrors the special release).
CREATE OR REPLACE FUNCTION public.on_booking_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_terminal text[] := ARRAY[
    'cancelled_by_host', 'cancelled_by_guest', 'declined', 'expired', 'no_show'
  ];
BEGIN
  IF NEW.status = ANY(v_terminal) AND COALESCE(OLD.status, '') <> NEW.status THEN
    -- Free every calendar block this booking placed.
    DELETE FROM blocked_dates WHERE booking_id = NEW.id;

    -- Return the claimed unit to the special's pool (a special booking redeems
    -- at creation time, regardless of confirm state).
    IF NEW.special_id IS NOT NULL THEN
      UPDATE specials
        SET redemptions_used = GREATEST(0, redemptions_used - 1)
        WHERE id = NEW.special_id;
    END IF;

    -- Return the claimed coupon redemption (also freeing the per-guest cap) so a
    -- cancelled booking doesn't permanently burn the coupon.
    IF NEW.coupon_id IS NOT NULL THEN
      PERFORM release_coupon(NEW.coupon_id, NEW.id);
    END IF;

    -- If the booking had been counted (it was confirmed/checked_in), roll the
    -- counters back so dashboards stay accurate.
    IF COALESCE(OLD.status, '') IN ('confirmed', 'checked_in') THEN
      UPDATE hosts
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.host_id;
      UPDATE properties
        SET total_bookings = GREATEST(0, total_bookings - 1)
        WHERE id = NEW.property_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.on_booking_cancelled IS
  'Releases blocked_dates, a special''s redemption, a coupon''s redemption (via release_coupon), and decrements booking counters when a booking enters a cancelled/declined/expired/no_show state.';
