-- Migration: Reviews MVP hardening
--
-- Brings the reviews domain to launch quality:
--   1. review_request_queue.send_at — drives the "5 minutes after checkout"
--      delayed review-request send (drained by /api/review-request-worker).
--   2. review_photos — guest-uploaded photos attached to a review, public bucket
--      'review-photos' (create in the Supabase dashboard as a PUBLIC bucket).
--   3. protect_review_content() — hosts (and everyone but a super admin) can
--      only ever add/edit a public response; review CONTENT is immutable.
--   4. on_review_published() now also fires on INSERT and on un-publish, so the
--      "publish immediately" flow keeps listing/host aggregates correct and
--      admin hide/restore decrements/increments them.

-- ─── 1. Delayed review-request queue ──────────────────────────────────────
ALTER TABLE public.review_request_queue
  ADD COLUMN IF NOT EXISTS send_at timestamptz NOT NULL DEFAULT now();

-- Existing rows: send immediately (they were queued the old way).
UPDATE public.review_request_queue SET send_at = created_at WHERE send_at > created_at;

-- The worker scans for due, unsent rows.
DROP INDEX IF EXISTS idx_review_queue_unsent;
CREATE INDEX idx_review_queue_due ON public.review_request_queue (send_at)
  WHERE sent_at IS NULL;

COMMENT ON COLUMN public.review_request_queue.send_at IS
  'When the review request may be sent. Set to checkout + 5 min; the '
  'review-request worker dispatches due rows (send_at <= now, sent_at null).';

-- ─── 2. review_photos ─────────────────────────────────────────────────────
CREATE TABLE public.review_photos (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid    NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  storage_path text    NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_photos_review ON public.review_photos (review_id, sort_order);

ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.review_photos IS
  'Guest-uploaded photos for a review. Files live in the public review-photos '
  'storage bucket; storage_path is the object key. Inserted server-side by the '
  'token-gated submit action (service role), so there is no client INSERT policy.';

-- Public reads photos of published, unflagged reviews (mirrors the
-- public_read_published_reviews policy on reviews).
CREATE POLICY "public_read_published_review_photos" ON public.review_photos
  FOR SELECT USING (
    review_id IN (SELECT id FROM reviews WHERE is_published = true AND flagged = false)
  );
-- The owning host sees photos on their own reviews (dashboard).
CREATE POLICY "host_read_own_review_photos" ON public.review_photos
  FOR SELECT USING (
    review_id IN (SELECT id FROM reviews WHERE host_id = get_my_host_id())
  );
-- The guest who wrote it sees their own photos (portal).
CREATE POLICY "guest_read_own_review_photos" ON public.review_photos
  FOR SELECT USING (
    review_id IN (SELECT id FROM reviews WHERE guest_id = auth.uid())
  );
CREATE POLICY "admin_full_review_photos" ON public.review_photos
  FOR ALL USING (is_super_admin());

-- Public read of the bucket's objects (the bucket itself is created in the
-- dashboard as PUBLIC; this policy is explicit defence-in-depth). Uploads use
-- a service-role signed URL, so no INSERT policy is required.
CREATE POLICY "public_read_review_photo_objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'review-photos');

-- ─── 3. Review content is immutable (hosts may only respond) ───────────────
CREATE OR REPLACE FUNCTION protect_review_content()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Super admins (moderation) may correct anything.
  IF is_super_admin() THEN
    RETURN NEW;
  END IF;
  -- Block any change to guest-authored content. host_response /
  -- host_responded_at, helpful_count, flag + publish columns stay editable so
  -- the host reply flow, helpful-vote sync and admin moderation still work.
  IF (NEW.rating              IS DISTINCT FROM OLD.rating
   OR NEW.body                IS DISTINCT FROM OLD.body
   OR NEW.rating_cleanliness  IS DISTINCT FROM OLD.rating_cleanliness
   OR NEW.rating_communication IS DISTINCT FROM OLD.rating_communication
   OR NEW.rating_checkin      IS DISTINCT FROM OLD.rating_checkin
   OR NEW.rating_accuracy     IS DISTINCT FROM OLD.rating_accuracy
   OR NEW.rating_location     IS DISTINCT FROM OLD.rating_location
   OR NEW.rating_value        IS DISTINCT FROM OLD.rating_value
   OR NEW.trip_type           IS DISTINCT FROM OLD.trip_type
   OR NEW.guest_id            IS DISTINCT FROM OLD.guest_id
   OR NEW.booking_id          IS DISTINCT FROM OLD.booking_id
   OR NEW.listing_id          IS DISTINCT FROM OLD.listing_id) THEN
    RAISE EXCEPTION 'Reviews are immutable: a host can only add a public response, not edit review content.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_protect_review_content
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION protect_review_content();

-- ─── 4. Aggregate recalc on insert + un-publish ────────────────────────────
CREATE OR REPLACE FUNCTION on_review_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Reviews now publish immediately on insert; recalc there too, and on any
  -- later is_published change (admin hide/restore) in either direction.
  IF TG_OP = 'INSERT' OR (NEW.is_published IS DISTINCT FROM OLD.is_published) THEN
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

DROP TRIGGER IF EXISTS trigger_review_published ON reviews;
CREATE TRIGGER trigger_review_published
  AFTER INSERT OR UPDATE OF is_published ON reviews
  FOR EACH ROW EXECUTE FUNCTION on_review_published();
