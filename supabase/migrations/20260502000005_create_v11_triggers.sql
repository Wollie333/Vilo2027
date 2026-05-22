-- Migration: v1.1 Triggers (Refund + Policy Manager)
-- Per supabase_database.md §13.6, §14.9, and v1.1 updated_at additions

-- ═══ updated_at on new tables ═════════════════════════════════
CREATE TRIGGER set_updated_at BEFORE UPDATE ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON policy_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══ Refund Manager triggers ══════════════════════════════════

-- Sync bookings.has_open_refund whenever a refund is created or resolved
CREATE OR REPLACE FUNCTION sync_booking_refund_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings
  SET has_open_refund = EXISTS (
    SELECT 1 FROM refund_requests
    WHERE booking_id = COALESCE(NEW.booking_id, OLD.booking_id)
      AND status IN ('pending','approved','processing','disputed','escalated')
  )
  WHERE id = COALESCE(NEW.booking_id, OLD.booking_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_sync_booking_refund_flag
  AFTER INSERT OR UPDATE OF status ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION sync_booking_refund_flag();

-- Append to refund_status_history on every status change
CREATE OR REPLACE FUNCTION log_refund_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO refund_status_history (
      refund_request_id, from_status, to_status,
      changed_by, changed_by_role, note
    ) VALUES (
      NEW.id, OLD.status, NEW.status,
      NEW.actioned_by,
      COALESCE((SELECT role FROM user_profiles WHERE id = NEW.actioned_by), 'system'),
      NEW.host_note
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_refund_status_change
  AFTER UPDATE OF status ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION log_refund_status_change();

-- Update payments.refunded_amount + payments.status when refund completes
CREATE OR REPLACE FUNCTION update_payment_refunded_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE payments
    SET refunded_amount = COALESCE(refunded_amount, 0) + COALESCE(NEW.approved_amount, 0)
    WHERE id = NEW.payment_id;

    UPDATE payments
    SET status = CASE
      WHEN refunded_amount >= amount THEN 'refunded'
      ELSE 'partially_refunded'
    END
    WHERE id = NEW.payment_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_payment_refunded
  AFTER UPDATE OF status ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION update_payment_refunded_amount();

-- ═══ Policy Manager triggers ══════════════════════════════════

-- Keep listings.cancellation_policy_label + is_non_refundable in sync
CREATE OR REPLACE FUNCTION sync_listing_policy_label()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pol policies%ROWTYPE;
BEGIN
  IF NEW.policy_type = 'cancellation' THEN
    SELECT * INTO v_pol FROM policies WHERE id = NEW.policy_id;
    UPDATE listings SET
      cancellation_policy_label = v_pol.name,
      is_non_refundable         = v_pol.is_non_refundable
    WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_listing_policy_label
  AFTER INSERT OR UPDATE ON listing_policies
  FOR EACH ROW EXECUTE FUNCTION sync_listing_policy_label();

-- Bump policy version when meaningful fields change
CREATE OR REPLACE FUNCTION version_policy_on_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR
     NEW.is_non_refundable IS DISTINCT FROM OLD.is_non_refundable OR
     NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_version_policy
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION version_policy_on_update();

-- Auto-generate plain-text fallback for policy content
CREATE OR REPLACE FUNCTION generate_policy_plain_text()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.body_plain IS NULL OR NEW.body_plain = '' THEN
    NEW.body_plain := regexp_replace(NEW.body_html, '<[^>]+>', ' ', 'g');
    NEW.body_plain := regexp_replace(trim(NEW.body_plain), '\s+', ' ', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_policy_plain_text
  BEFORE INSERT OR UPDATE OF body_html ON policy_content
  FOR EACH ROW EXECUTE FUNCTION generate_policy_plain_text();
