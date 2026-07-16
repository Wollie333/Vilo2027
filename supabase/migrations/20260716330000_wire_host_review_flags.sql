-- Make the host's review dispute actually possible.
--
-- The whole chain around it was already built — the host "Flagged" tab, an admin
-- queue that DEFAULTS to flagged, an /admin counter, and an RLS guard written in
-- 20260716250000 to preserve the host's right to flag. Everything except a caller
-- (docs/WIRING_AUDIT.md §2). This migration fixes the two things that caller would
-- have hit on its very first click.
--
-- 1. review_flags has been LOCKED SHUT SINCE MAY. 20260501000007 line 65 ran
--    `ALTER TABLE review_flags ENABLE ROW LEVEL SECURITY` and then never wrote a
--    single policy. RLS with zero policies denies every non-service-role write, so
--    flagReviewAction's insert could never have succeeded. Proven on live as role
--    `authenticated`, in a rollback:
--
--      42501 / new row violates row-level security policy for table "review_flags"
--
--    Not 23503 — the FK on the fake uuids never got a say, because RLS refused
--    first. Nobody noticed because the action had no caller to notice with.
--
-- 2. The anti-spam constraint the code claims does not exist. actions.ts says "the
--    unique check on (review_id, flagged_by) keeps hosts from flag-spamming the
--    same review" — no migration ever added it (docs/lifecycles/reviews.md gap 7).
--    A comment is not a constraint. It is one now.

-- The owning host may raise a flag on their own review, as themselves.
-- The EXISTS runs as the caller, so `host_read_own_reviews` gates it a second time
-- and a host cannot flag a review that isn't theirs. Admin moderation is unaffected:
-- hideReviewAction / restoreReviewAction go through the service-role client, which
-- bypasses RLS entirely.
CREATE POLICY host_flag_own_reviews ON public.review_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    flagged_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.reviews r
      WHERE r.id = review_flags.review_id
        AND r.host_id = get_my_host_id()
    )
  );

-- One report per person per review — exactly what the code already promised.
-- Safe to add unconditionally: 0 rows on live, 0 duplicate (review_id, flagged_by)
-- pairs, verified before writing this.
ALTER TABLE public.review_flags
  ADD CONSTRAINT review_flags_one_per_flagger UNIQUE (review_id, flagged_by);

COMMENT ON CONSTRAINT review_flags_one_per_flagger ON public.review_flags IS
  'One flag per user per review. flagReviewAction surfaces the 23505 as "already reported" rather than a retry prompt.';
