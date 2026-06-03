-- Migration: a listing cannot go live without a valid default bank account.
--
-- Rule (AGENT_RULES.md §4.5): every host must have a default, non-archived EFT
-- bank account before any listing can be published. EFT is the guaranteed
-- payment fallback (§4.6), so this is also what makes that fallback reliable.
--
-- The app-level gate lives in togglePublishAction (friendly error message);
-- this trigger is the unbypassable DB-layer guarantee. It fires ONLY on the
-- genuine go-live transition (is_published false -> true via UPDATE), so it
-- never interferes with seed/test rows that INSERT with is_published = true for
-- a host that already has banking.

CREATE OR REPLACE FUNCTION public.enforce_listing_requires_bank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.eft_banking_details
    WHERE host_id = NEW.host_id
      AND is_default = true
      AND is_archived = false
  ) THEN
    RAISE EXCEPTION
      'A default bank account is required before a listing can go live (host %).',
      NEW.host_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_requires_bank ON public.listings;
CREATE TRIGGER trg_listing_requires_bank
  BEFORE UPDATE OF is_published ON public.listings
  FOR EACH ROW
  WHEN (NEW.is_published = true AND COALESCE(OLD.is_published, false) = false)
  EXECUTE FUNCTION public.enforce_listing_requires_bank();

COMMENT ON FUNCTION public.enforce_listing_requires_bank() IS
  'Blocks publishing a listing (is_published false->true) unless the host has a default, non-archived eft_banking_details row. See AGENT_RULES.md §4.5.';
