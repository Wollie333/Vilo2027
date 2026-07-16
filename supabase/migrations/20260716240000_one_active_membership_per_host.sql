-- Enforce the founder's rule at the DB: "one subscription product, many services,
-- many packages" — a host may hold AT MOST ONE active membership, alongside any
-- number of service / product / credit subscriptions.
--
-- Three call sites already retire other memberships before activating one and
-- their comments say "else the DB trigger rejects the write" — the trigger was
-- simply never added. This adds it. Nothing changes for correct callers; it turns
-- a silent data corruption into a loud, catchable error.
--
-- Not cosmetic. check_feature_permission resolves allowances with max(limit_value)
-- across every ACTIVE subscription, so a second active membership can out-vote the
-- plan the host actually pays for. Seen live: a host on Starter (pro = 50 credits)
-- resolving 200 from a leftover 'business' baseline — four times their entitlement
-- on a paid meter. Fixed in 39e17078; this stops it coming back.
--
-- WHAT COUNTS AS A MEMBERSHIP
--   product_id IS NULL                      -> the signup baseline: the free "guest"
--                                              tier every account starts on
--                                              (signup/host/actions.ts §4). It IS a
--                                              membership, it just has no catalog row.
--                                              NEVER treat it as junk.
--   products.product_type = 'membership'    -> a real catalog membership.
-- 'service' / 'product' / 'wielo_credits' subs are unlimited and never counted.
--
-- WHAT COUNTS AS HELD: status IN (trialing, active, past_due).
-- 'paused' deliberately does NOT hold the slot (founder call): a paused host may
-- buy a new membership. This matches the retire filters, which have always used
-- exactly these three statuses, and isLiveMembershipStatus() in
-- lib/subscriptions/currentMembership.ts. Keep the three definitions in step.
--
-- A plain partial unique index cannot express this: "membership" needs a join to
-- products, and index predicates must be immutable. Hence a trigger.

CREATE OR REPLACE FUNCTION public.forbid_second_active_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_membership boolean;
  v_count integer;
BEGIN
  -- Only writes that RESULT IN a held membership can break the rule. Cancelling,
  -- pausing or expiring a row can only ever reduce the count, so let it through.
  IF NEW.status NOT IN ('trialing', 'active', 'past_due') THEN
    RETURN NEW;
  END IF;

  SELECT NEW.product_id IS NULL
      OR EXISTS (
           SELECT 1 FROM products p
            WHERE p.id = NEW.product_id AND p.product_type = 'membership'
         )
    INTO v_is_membership;

  IF NOT v_is_membership THEN
    RETURN NEW;   -- a service/package sub: unlimited, never counted
  END IF;

  SELECT count(*)
    INTO v_count
    FROM subscriptions s
    LEFT JOIN products p ON p.id = s.product_id
   WHERE s.host_id = NEW.host_id
     AND s.id <> NEW.id                         -- exclude the row being written
     AND s.status IN ('trialing', 'active', 'past_due')
     AND (s.product_id IS NULL OR p.product_type = 'membership');

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'host % already holds an active membership; retire it before activating another (subscription %)',
      NEW.host_id, NEW.id
      USING ERRCODE = 'unique_violation',
            HINT = 'Cancel/expire the existing active membership first — see retireOtherMemberships(). A product-less subscription is the signup baseline and counts as a membership.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.forbid_second_active_membership IS
  'Enforces one active membership per host. A membership = product_id IS NULL (the signup guest-tier baseline) OR products.product_type = membership. Held = status in (trialing, active, past_due); paused frees the slot. Services/packages are unlimited.';

DROP TRIGGER IF EXISTS trg_one_active_membership ON public.subscriptions;
CREATE TRIGGER trg_one_active_membership
  BEFORE INSERT OR UPDATE OF status, product_id, host_id ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_second_active_membership();
