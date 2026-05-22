-- Migration: Cross-domain triggers (v1.0)
-- Per supabase_database.md §17
-- Domain-specific triggers (handle_new_user, sync_listing_location) are in their respective domain migrations.

-- ─── updated_at auto-update (applied to all mutable tables) ───
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hosts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON eft_banking_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Booking confirmed → Block dates + update counters ───────
CREATE OR REPLACE FUNCTION on_booking_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_date date;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
      v_date := NEW.check_in;
      WHILE v_date < NEW.check_out LOOP
        INSERT INTO blocked_dates (listing_id, date, reason, booking_id)
        VALUES (NEW.listing_id, v_date, 'booking', NEW.id)
        ON CONFLICT (listing_id, date) DO NOTHING;
        v_date := v_date + 1;
      END LOOP;
    END IF;
    UPDATE hosts    SET total_bookings = total_bookings + 1 WHERE id = NEW.host_id;
    UPDATE listings SET total_bookings = total_bookings + 1 WHERE id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_booking_confirmed
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_confirmed();

-- ─── Booking cancelled → Unblock dates ───────────────────────
CREATE OR REPLACE FUNCTION on_booking_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IN ('cancelled_by_host','cancelled_by_guest','expired','declined')
     AND OLD.status NOT IN ('cancelled_by_host','cancelled_by_guest','expired','declined') THEN
    DELETE FROM blocked_dates WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_booking_cancelled
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION on_booking_cancelled();

-- ─── Review published → Update aggregate ratings ─────────────
CREATE OR REPLACE FUNCTION on_review_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_published = true AND COALESCE(OLD.is_published, false) = false THEN
    UPDATE listings SET
      avg_rating    = (SELECT AVG(rating) FROM reviews WHERE listing_id = NEW.listing_id AND is_published = true),
      total_reviews = (SELECT COUNT(*)    FROM reviews WHERE listing_id = NEW.listing_id AND is_published = true)
    WHERE id = NEW.listing_id;

    UPDATE hosts SET
      avg_rating    = (SELECT AVG(r.rating) FROM reviews r JOIN listings l ON l.id = r.listing_id WHERE l.host_id = NEW.host_id AND r.is_published = true),
      total_reviews = (SELECT COUNT(*)      FROM reviews r JOIN listings l ON l.id = r.listing_id WHERE l.host_id = NEW.host_id AND r.is_published = true)
    WHERE id = NEW.host_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_review_published
  AFTER UPDATE OF is_published ON reviews
  FOR EACH ROW EXECUTE FUNCTION on_review_published();

-- ─── Message inserted → Update conversation unread + preview ─
CREATE OR REPLACE FUNCTION on_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_conv conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
  UPDATE conversations SET
    last_message_at      = NEW.created_at,
    last_message_preview = left(NEW.body, 100),
    unread_host  = CASE WHEN NEW.sender_id != v_conv.host_id THEN unread_host + 1  ELSE unread_host  END,
    unread_guest = CASE WHEN NEW.sender_id  = v_conv.host_id THEN unread_guest + 1 ELSE unread_guest END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION on_message_inserted();

-- ─── Auto-generate listing slug ──────────────────────────────
CREATE OR REPLACE FUNCTION generate_listing_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_base text; v_slug text; v_n integer := 0;
BEGIN
  IF NEW.slug IS NULL THEN
    v_base := lower(regexp_replace(regexp_replace(NEW.name,'[^a-zA-Z0-9\s]','','g'),'\s+','-','g'));
    v_slug := v_base;
    WHILE EXISTS (SELECT 1 FROM listings WHERE slug = v_slug AND id != NEW.id) LOOP
      v_n := v_n + 1; v_slug := v_base || '-' || v_n;
    END LOOP;
    NEW.slug := v_slug;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_listing_slug
  BEFORE INSERT OR UPDATE OF name ON listings
  FOR EACH ROW EXECUTE FUNCTION generate_listing_slug();

-- ─── Auto-generate host handle ───────────────────────────────
CREATE OR REPLACE FUNCTION generate_host_handle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_base text; v_handle text; v_n integer := 0;
BEGIN
  IF NEW.handle IS NULL OR NEW.handle = '' THEN
    v_base := lower(regexp_replace(regexp_replace(NEW.display_name,'[^a-zA-Z0-9\s]','','g'),'\s+','-','g'));
    v_handle := v_base;
    WHILE EXISTS (SELECT 1 FROM hosts WHERE handle = v_handle AND id != NEW.id) LOOP
      v_n := v_n + 1; v_handle := v_base || '-' || v_n;
    END LOOP;
    NEW.handle := v_handle;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trigger_host_handle
  BEFORE INSERT ON hosts
  FOR EACH ROW EXECUTE FUNCTION generate_host_handle();
