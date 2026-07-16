-- A host could undo an admin's moderation.
--
-- RLS `host_respond_reviews` is a blanket `FOR UPDATE USING (host_id =
-- get_my_host_id())` — no column restriction — and protect_review_content()
-- deliberately left "flag + publish columns editable so the host reply flow,
-- helpful-vote sync and admin moderation still work". Together that means a host
-- can run, against their own review:
--
--     UPDATE reviews SET is_published = true, flagged = false;   -- un-hide what an admin hid
--     UPDATE reviews SET is_published = false;                   -- bury a bad review
--
-- The admin UI assumes those columns are admin-only. Nothing enforced it. This
-- trigger is the only place that can: the policy can't express "these columns
-- are off-limits", and widening RLS would break the reply flow.
--
-- WHO IS EXEMPT, and why it is NOT simply `is_super_admin()`:
--   is_super_admin() = EXISTS(platform_staff WHERE user_id = auth.uid() …), so it
--   is FALSE for the service-role client — which is exactly how hideReviewAction /
--   restoreReviewAction write (admin/reviews/actions.ts uses createAdminClient).
--   Gating on is_super_admin() alone would therefore have broken admin moderation
--   itself. The threat is an END-USER session, which always carries auth.uid();
--   trusted server contexts (service role, pg_cron) have auth.uid() = NULL.
--
-- WHAT A HOST MAY STILL DO — deliberately unchanged:
--   * add/edit/clear host_response + host_responded_at (the reply flow)
--   * RAISE a flag for admin attention: flagged false -> true, with flagged_at /
--     flagged_reason (flagReviewAction, which runs on the host's own session)
--   * helpful_count still syncs (sync_review_helpful_count)
-- What a host may NOT do: publish/unpublish, CLEAR a flag, or touch
-- admin_decision / admin_actioned_by.
--
-- Previous definition: 20260617000300_rename_r3_columns.sql (guest-content half
-- below is carried over verbatim).

CREATE OR REPLACE FUNCTION public.protect_review_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Super admins (moderation) may correct anything.
  IF is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- ── Moderation columns are admin-only ────────────────────────────────────
  -- auth.uid() IS NOT NULL == a real end-user session (host/guest). The service
  -- role and pg_cron have no JWT, so they fall through to the checks below —
  -- that is what keeps hideReviewAction/restoreReviewAction and the
  -- auto-publish-reviews cron working.
  IF auth.uid() IS NOT NULL THEN
    IF (NEW.is_published      IS DISTINCT FROM OLD.is_published
     OR NEW.admin_decision    IS DISTINCT FROM OLD.admin_decision
     OR NEW.admin_actioned_by IS DISTINCT FROM OLD.admin_actioned_by) THEN
      RAISE EXCEPTION
        'Publishing and moderation of a review are admin-only (review %).', OLD.id
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'A host may reply to a review and may flag it for admin attention, but cannot publish, unpublish, or decide a flag.';
    END IF;

    -- Raising a flag is a host's right; clearing one is an admin decision.
    IF COALESCE(OLD.flagged, false) = true
       AND COALESCE(NEW.flagged, false) = false THEN
      RAISE EXCEPTION
        'Only an admin can clear a flag on a review (review %).', OLD.id
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Flag it for admin attention instead; an admin resolves the flag.';
    END IF;
  END IF;

  -- ── Guest-authored content is immutable (unchanged) ──────────────────────
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
   OR NEW.property_id          IS DISTINCT FROM OLD.property_id) THEN
    RAISE EXCEPTION 'Reviews are immutable: a host can only add a public response, not edit review content.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_review_content IS
  'Reviews integrity guard. Guest-authored content is immutable. Publishing + moderation columns (is_published, admin_decision, admin_actioned_by) and CLEARING a flag are admin-only: blocked for any session with auth.uid(), allowed for super admins and for trusted no-JWT contexts (service role = the admin actions, pg_cron). A host may still reply and may RAISE a flag.';
