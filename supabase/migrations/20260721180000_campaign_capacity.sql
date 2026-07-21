-- Competition capacity — cap how many partners may take part.
--
-- The Founding Programme is explicitly "≤25 Founding Partners", so a campaign
-- needs a place limit. Enforcing it only in the enrol action would be a lie
-- under concurrency: two partners clicking Join at the same moment both read
-- "24 taken" and both get in. Prizes and a lifetime commission ladder hang off
-- this number, so it is enforced HERE, where it cannot be raced.
--
-- NULL = unlimited (the existing behaviour for every campaign already created).

ALTER TABLE public.affiliate_campaigns
  ADD COLUMN IF NOT EXISTS max_participants integer;

ALTER TABLE public.affiliate_campaigns
  DROP CONSTRAINT IF EXISTS affiliate_campaigns_max_participants_check;
ALTER TABLE public.affiliate_campaigns
  ADD CONSTRAINT affiliate_campaigns_max_participants_check
  CHECK (max_participants IS NULL OR max_participants > 0);

COMMENT ON COLUMN public.affiliate_campaigns.max_participants IS
  'Maximum ACTIVE enrolments. NULL = unlimited. Enforced by trg_campaign_capacity, which locks the campaign row so concurrent joins cannot both slip past the cap.';

CREATE OR REPLACE FUNCTION public.enforce_campaign_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cap   integer;
  v_taken integer;
BEGIN
  -- Only an ACTIVE enrolment consumes a place: a withdrawn/removed partner
  -- frees theirs, and re-activating is subject to the same check.
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  -- Serialise every join for this campaign behind the campaign row. Without
  -- this lock two concurrent inserts both count the pre-insert total.
  SELECT max_participants INTO v_cap
  FROM affiliate_campaigns
  WHERE id = NEW.campaign_id
  FOR UPDATE;

  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_taken
  FROM affiliate_campaign_enrollments
  WHERE campaign_id = NEW.campaign_id
    AND status = 'active'
    -- An already-enrolled partner keeps their place: a repeat join (the
    -- action upserts) and an UPDATE back to active must not be blocked by
    -- the seat they already hold.
    AND affiliate_id IS DISTINCT FROM NEW.affiliate_id;

  IF v_taken >= v_cap THEN
    RAISE EXCEPTION
      'campaign_full: this competition has all % places taken.', v_cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_capacity ON public.affiliate_campaign_enrollments;
CREATE TRIGGER trg_campaign_capacity
  BEFORE INSERT OR UPDATE OF status, campaign_id
  ON public.affiliate_campaign_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_capacity();

COMMENT ON FUNCTION public.enforce_campaign_capacity IS
  'Rejects an enrolment once a campaign has max_participants active partners. Locks the campaign row so simultaneous joins cannot exceed the cap.';
