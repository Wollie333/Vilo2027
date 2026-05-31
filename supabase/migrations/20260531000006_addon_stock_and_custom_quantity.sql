-- Migration: Add-on guest quantity control + live stock
--
-- 1. addons.allow_custom_quantity — host lets the guest pick a quantity (else the
--    quantity is fixed/pinned). addons.stock_quantity — live inventory (NULL =
--    unlimited), decremented per booking and restored on cancel/expiry.
-- 2. reserve_addon_stock / release_addon_stock / release_booking_addon_stock —
--    atomic stock helpers used by booking creation and the cancel trigger.
-- 3. on_booking_cancelled() extended to give add-on stock back on every
--    cancel/expiry/decline transition (covers all 3 expiry cron jobs + host
--    decline/cancel + guest cancel).
-- 4. compute_addon_subtotal() parity update for the new pricing (the standalone
--    nights multiplier is gone; per-night quantity now carries the night count).
--    NOTE: this SQL fn has no live callers; the app uses the TS mirror. Updated
--    only to keep the documented "source of truth" honest.
--
-- Pre-MVP data policy (CLAUDE.md): additive columns, no backfill needed.

-- ─── 1. New columns ──────────────────────────────────────────────
ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS allow_custom_quantity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_quantity integer
    CHECK (stock_quantity IS NULL OR stock_quantity >= 0);

COMMENT ON COLUMN public.addons.allow_custom_quantity IS
  'true = guest may change the quantity (between min and max/stock). false = fixed: pinned to the model default (full nights for per-night, else min_quantity).';
COMMENT ON COLUMN public.addons.stock_quantity IS
  'Live inventory in stepper units (nights for per-night add-ons, else units). NULL = unlimited. Decremented on booking creation, restored on cancel/expiry.';

-- ─── 2. Atomic stock helpers ─────────────────────────────────────
-- Reserve p_qty units. Succeeds (and decrements) when there is enough stock, OR
-- when stock is unlimited (NULL stays NULL). Returns false on insufficient stock
-- so the caller can reject the booking. SECURITY DEFINER so the admin/server
-- path can run it regardless of RLS.
CREATE OR REPLACE FUNCTION public.reserve_addon_stock(
  p_addon_id uuid,
  p_qty      integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN true;
  END IF;
  UPDATE public.addons
     SET stock_quantity = stock_quantity - p_qty
   WHERE id = p_addon_id
     AND (stock_quantity IS NULL OR stock_quantity >= p_qty);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

-- Give p_qty units back. No-op for unlimited (NULL) add-ons.
CREATE OR REPLACE FUNCTION public.release_addon_stock(
  p_addon_id uuid,
  p_qty      integer
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.addons
     SET stock_quantity = stock_quantity + p_qty
   WHERE id = p_addon_id
     AND stock_quantity IS NOT NULL
     AND p_qty IS NOT NULL
     AND p_qty > 0;
$$;

-- Release every stock-tracked add-on line of a booking (used by the cancel
-- trigger). Free-form quote lines (addon_id IS NULL) are skipped.
CREATE OR REPLACE FUNCTION public.release_booking_addon_stock(
  p_booking_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT addon_id, quantity
    FROM public.booking_addons
    WHERE booking_id = p_booking_id AND addon_id IS NOT NULL
  LOOP
    PERFORM public.release_addon_stock(r.addon_id, r.quantity::integer);
  END LOOP;
END;
$$;

-- ─── 3. Extend the cancel trigger to restore add-on stock ────────
-- Mirrors 20260501000013_create_triggers.sql; adds the stock release. The
-- OLD.status guard already prevents a double-release on re-entry.
CREATE OR REPLACE FUNCTION public.on_booking_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IN ('cancelled_by_host','cancelled_by_guest','expired','declined')
     AND OLD.status NOT IN ('cancelled_by_host','cancelled_by_guest','expired','declined') THEN
    DELETE FROM blocked_dates WHERE booking_id = NEW.id;
    PERFORM public.release_booking_addon_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 4. compute_addon_subtotal parity (dead code; kept honest) ───
CREATE OR REPLACE FUNCTION public.compute_addon_subtotal(
  p_pricing_model text,
  p_unit_price    numeric,
  p_quantity      integer,
  p_nights        integer,
  p_guests        integer
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT p_unit_price * p_quantity * CASE p_pricing_model
    WHEN 'per_stay'            THEN 1
    WHEN 'per_night'           THEN 1
    WHEN 'per_guest'           THEN p_guests
    WHEN 'per_guest_per_night' THEN p_guests
    WHEN 'per_couple'          THEN ceil(p_guests::numeric / 2)
  END;
$$;
