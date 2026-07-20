-- WS-3a — Build Board (public feature-request voting).
--
-- A public roadmap where anyone signed in can submit + vote on feature ideas, so
-- the beta feels real and hosts see their asks land. Mirrors the proven
-- review_helpful_votes pattern (one vote per user, denormalised count kept in
-- sync by trigger) — `article_votes` referenced in the plan never existed.
--
-- 5 honest statuses (incl. "Not doing"). Votes are ROLE-TAGGED (host vs guest)
-- so guest volume never drowns the host signal — the board can weight or show
-- them separately. Submissions land unpublished (is_public=false) for a light
-- moderation pass; an admin approves them onto the public board. Duplicates are
-- merged via merge_feature_requests(), which migrates votes and hides the source.

-- ─── Status enum ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE feature_request_status AS ENUM
    ('under_review', 'planned', 'in_progress', 'shipped', 'not_doing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── feature_requests ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  body            text,
  status          feature_request_status NOT NULL DEFAULT 'under_review',
  -- Moderation gate: submissions start hidden; an admin approves to publish.
  is_public       boolean NOT NULL DEFAULT false,
  -- Who asked (kept if the account is later deleted) + their role AT submit time.
  submitted_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitter_role  text CHECK (submitter_role IS NULL OR submitter_role IN ('host', 'guest')),
  -- Denormalised vote tallies, kept in sync by trigger. Split by role so guest
  -- volume can be shown/weighted separately from host demand.
  vote_count       integer NOT NULL DEFAULT 0,
  host_vote_count  integer NOT NULL DEFAULT 0,
  guest_vote_count integer NOT NULL DEFAULT 0,
  -- Duplicate merge: non-null → this row was merged INTO another (hidden).
  merged_into_id  uuid REFERENCES public.feature_requests(id) ON DELETE SET NULL,
  admin_note      text,
  -- When it shipped (drives the "Shipped" ordering + a future changelog deep-link).
  shipped_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feature_requests_title_len CHECK (char_length(title) BETWEEN 3 AND 140),
  CONSTRAINT feature_requests_body_len  CHECK (body IS NULL OR char_length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_board
  ON public.feature_requests (status, vote_count DESC)
  WHERE is_public = true AND merged_into_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_feature_requests_submitted_by
  ON public.feature_requests (submitted_by);
CREATE INDEX IF NOT EXISTS idx_feature_requests_merged_into
  ON public.feature_requests (merged_into_id);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.feature_requests IS
  'Public Build Board items. is_public gates the moderation queue; merged_into_id hides merged duplicates. Vote tallies are denormalised (trigger-synced from feature_request_votes).';

-- Published, non-merged items are public content — anyone may read them.
DROP POLICY IF EXISTS "public_read_published_requests" ON public.feature_requests;
CREATE POLICY "public_read_published_requests" ON public.feature_requests FOR SELECT
  USING (is_public = true AND merged_into_id IS NULL);

-- A submitter can always see their own item, even while it's pending moderation.
DROP POLICY IF EXISTS "submitter_reads_own_request" ON public.feature_requests;
CREATE POLICY "submitter_reads_own_request" ON public.feature_requests FOR SELECT
  USING (submitted_by = auth.uid());

-- Signed-in users submit their own idea; they cannot self-publish or self-merge.
DROP POLICY IF EXISTS "user_submits_request" ON public.feature_requests;
CREATE POLICY "user_submits_request" ON public.feature_requests FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND is_public = false
    AND merged_into_id IS NULL
  );

-- All moderation (approve, status, merge, notes) is admin-only.
DROP POLICY IF EXISTS "admin_full_feature_requests" ON public.feature_requests;
CREATE POLICY "admin_full_feature_requests" ON public.feature_requests FOR ALL
  USING (is_super_admin());

-- ─── feature_request_votes ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_request_votes (
  request_id  uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voter_role  text NOT NULL CHECK (voter_role IN ('host', 'guest')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_request_votes_user
  ON public.feature_request_votes (user_id);

ALTER TABLE public.feature_request_votes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.feature_request_votes IS
  'One vote per signed-in user per feature request. voter_role snapshots host/guest at vote time. The denormalised tallies on feature_requests are the display source.';

-- Anyone signed in can see/cast/retract their OWN vote; the public reads the
-- denormalised counts on feature_requests, not these rows.
DROP POLICY IF EXISTS "user_reads_own_feature_vote" ON public.feature_request_votes;
CREATE POLICY "user_reads_own_feature_vote" ON public.feature_request_votes FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_inserts_own_feature_vote" ON public.feature_request_votes;
CREATE POLICY "user_inserts_own_feature_vote" ON public.feature_request_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_deletes_own_feature_vote" ON public.feature_request_votes;
CREATE POLICY "user_deletes_own_feature_vote" ON public.feature_request_votes FOR DELETE
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "admin_full_feature_votes" ON public.feature_request_votes;
CREATE POLICY "admin_full_feature_votes" ON public.feature_request_votes FOR ALL
  USING (is_super_admin());

-- ─── Count-sync trigger (clone of sync_review_helpful_count) ─────
CREATE OR REPLACE FUNCTION public.sync_feature_request_votes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feature_requests SET
      vote_count       = vote_count + 1,
      host_vote_count  = host_vote_count  + (CASE WHEN NEW.voter_role = 'host'  THEN 1 ELSE 0 END),
      guest_vote_count = guest_vote_count + (CASE WHEN NEW.voter_role = 'guest' THEN 1 ELSE 0 END),
      updated_at       = now()
    WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feature_requests SET
      vote_count       = GREATEST(0, vote_count - 1),
      host_vote_count  = GREATEST(0, host_vote_count  - (CASE WHEN OLD.voter_role = 'host'  THEN 1 ELSE 0 END)),
      guest_vote_count = GREATEST(0, guest_vote_count - (CASE WHEN OLD.voter_role = 'guest' THEN 1 ELSE 0 END)),
      updated_at       = now()
    WHERE id = OLD.request_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_feature_request_votes ON public.feature_request_votes;
CREATE TRIGGER trigger_feature_request_votes
  AFTER INSERT OR DELETE ON public.feature_request_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_feature_request_votes();

-- ─── Merge duplicates (admin) ────────────────────────────────────
-- Moves the source's votes onto the target (dropping would-be duplicate votes),
-- hides the source (merged_into_id → target), then recomputes both tallies from
-- the live vote rows. Guarded by is_super_admin() → MUST be called with the
-- admin's own session (auth.uid()), not the service_role client.
CREATE OR REPLACE FUNCTION public.merge_feature_requests(p_source uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_source = p_target THEN
    RAISE EXCEPTION 'cannot merge a request into itself';
  END IF;

  -- Drop source votes that would collide with an existing target vote (same user
  -- voted on both), then re-point the rest at the target.
  DELETE FROM public.feature_request_votes s
   WHERE s.request_id = p_source
     AND EXISTS (
       SELECT 1 FROM public.feature_request_votes t
        WHERE t.request_id = p_target AND t.user_id = s.user_id
     );
  UPDATE public.feature_request_votes
     SET request_id = p_target
   WHERE request_id = p_source;

  -- Hide the source under the target.
  UPDATE public.feature_requests
     SET merged_into_id = p_target, is_public = false,
         vote_count = 0, host_vote_count = 0, guest_vote_count = 0,
         updated_at = now()
   WHERE id = p_source;

  -- Recompute the target tallies from the live vote rows (the UPDATE above does
  -- not fire the INSERT/DELETE trigger).
  UPDATE public.feature_requests fr SET
    vote_count       = c.total,
    host_vote_count  = c.hosts,
    guest_vote_count = c.guests,
    updated_at       = now()
  FROM (
    SELECT
      count(*)                                        AS total,
      count(*) FILTER (WHERE voter_role = 'host')     AS hosts,
      count(*) FILTER (WHERE voter_role = 'guest')    AS guests
    FROM public.feature_request_votes
    WHERE request_id = p_target
  ) c
  WHERE fr.id = p_target;
END;
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default — lock it to signed-in
-- callers (the internal is_super_admin() check is the real gate).
REVOKE ALL ON FUNCTION public.merge_feature_requests(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_feature_requests(uuid, uuid) TO authenticated;

-- ─── Seed — a realistic board across every status ────────────────
-- Published (is_public), no submitted_by (platform-seeded). Vote tallies are set
-- directly (display source); real votes adjust them via the trigger from here on.
INSERT INTO public.feature_requests
  (title, body, status, is_public, submitter_role, vote_count, host_vote_count, guest_vote_count, shipped_at)
VALUES
  -- Under review
  ('WhatsApp booking notifications', 'Get a WhatsApp message the moment a guest books, not just email.', 'under_review', true, 'host', 41, 33, 8, NULL),
  ('Split payments between co-hosts', 'Automatically split a booking payout between two owners of the same property.', 'under_review', true, 'host', 27, 24, 3, NULL),
  ('Guest loyalty / repeat-stay discount', 'Let hosts reward returning guests with an automatic discount code.', 'under_review', true, 'guest', 22, 6, 16, NULL),
  ('Multi-currency payouts', 'Settle payouts in USD/EUR for hosts taking international guests.', 'under_review', true, 'host', 19, 18, 1, NULL),
  ('Saved payment methods for guests', 'Remember my card so I do not re-enter it every booking.', 'under_review', true, 'guest', 14, 2, 12, NULL),
  ('Import reviews from Airbnb', 'Bring my existing star reviews across so my Wielo page is not empty on day one.', 'under_review', true, 'host', 12, 11, 1, NULL),

  -- Planned
  ('iCal two-way sync with Booking.com', 'Block dates automatically when a room sells on Booking.com and vice-versa.', 'planned', true, 'host', 58, 52, 6, NULL),
  ('Downloadable VAT invoice for guests', 'A proper tax invoice I can claim for a business trip.', 'planned', true, 'guest', 31, 4, 27, NULL),
  ('Bulk-edit nightly rates by season', 'Set a whole season''s pricing in one action instead of day by day.', 'planned', true, 'host', 44, 42, 2, NULL),
  ('Guest ID / FICA document upload', 'Collect ID documents securely at booking for compliance.', 'planned', true, 'host', 21, 20, 1, NULL),
  ('Wishlist / save a property for later', 'Let me save stays I like and come back to them.', 'planned', true, 'guest', 17, 1, 16, NULL),

  -- In progress
  ('Magic-link (passwordless) sign-in', 'Skip the password — email me a secure link to log in.', 'in_progress', true, 'guest', 39, 9, 30, NULL),
  ('Per-listing add-on pricing', 'Charge for extra listings on one subscription instead of a new plan.', 'in_progress', true, 'host', 35, 34, 1, NULL),
  ('Public Looking-For request board', 'Let me post what I want and have hosts send me quotes.', 'in_progress', true, 'guest', 29, 7, 22, NULL),
  ('Host quote builder for enquiries', 'Reply to a guest enquiry with a formatted, acceptable quote.', 'in_progress', true, 'host', 26, 25, 1, NULL),

  -- Shipped
  ('Direct EFT payments (no card needed)', 'Accept manual EFT and confirm the booking once paid.', 'shipped', true, 'host', 47, 40, 7, now() - interval '20 days'),
  ('PayPal checkout for guests', 'Pay with PayPal, not only a South African card.', 'shipped', true, 'guest', 33, 5, 28, now() - interval '15 days'),
  ('Seasonal pricing rules', 'Higher rates over December and long weekends, set once.', 'shipped', true, 'host', 51, 49, 2, now() - interval '9 days'),
  ('Cancellation policy with refund preview', 'Show guests exactly what they get back before they cancel.', 'shipped', true, 'guest', 24, 3, 21, now() - interval '6 days'),
  ('Affiliate referral programme', 'Earn commission for referring hosts to Wielo.', 'shipped', true, 'host', 30, 28, 2, now() - interval '3 days'),

  -- Not doing (honest)
  ('Charge guests a booking fee', 'Add a small service fee on top of the nightly rate.', 'not_doing', true, 'host', 4, 4, 0, NULL),
  ('Sell guest email lists to partners', 'Monetise the guest database with third-party offers.', 'not_doing', true, NULL, 0, 0, 0, NULL),
  ('Instagram-style public feed of all guests', 'A social feed showing everyone''s trips publicly.', 'not_doing', true, 'guest', 6, 1, 5, NULL)
ON CONFLICT DO NOTHING;
