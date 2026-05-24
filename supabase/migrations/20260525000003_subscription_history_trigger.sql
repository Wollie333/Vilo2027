-- Migration: Auto-write subscription_history on every plan/status change
-- Per supabase_database.md §8 — subscription_history is append-only and
-- captures every state transition. Until now nothing wrote to it; this
-- adds an AFTER UPDATE trigger so every host-facing or admin-facing
-- mutation gets a free audit row.

-- Helper: write a single subscription_history row. Bypasses the
-- "no INSERT policy" by being SECURITY DEFINER (function owner is
-- postgres). Returns void.
CREATE OR REPLACE FUNCTION public.log_subscription_event(
  p_subscription_id uuid,
  p_host_id         uuid,
  p_event           text,
  p_from_plan       text,
  p_to_plan         text,
  p_from_status     text,
  p_to_status       text,
  p_notes           text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscription_history (
    subscription_id, host_id, event,
    from_plan, to_plan, from_status, to_status,
    notes, performed_by
  ) VALUES (
    p_subscription_id, p_host_id, p_event,
    p_from_plan, p_to_plan, p_from_status, p_to_status,
    p_notes, auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_subscription_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_subscription_event TO authenticated, service_role;

-- Trigger fn — records a history row whenever plan, status,
-- billing_cycle, or cancel_at_period_end changes.
CREATE OR REPLACE FUNCTION public.on_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
BEGIN
  -- Skip when nothing audit-worthy changed.
  IF NEW.plan = OLD.plan
     AND NEW.status = OLD.status
     AND COALESCE(NEW.billing_cycle, '') = COALESCE(OLD.billing_cycle, '')
     AND NEW.cancel_at_period_end = OLD.cancel_at_period_end
  THEN
    RETURN NEW;
  END IF;

  -- Compose a friendly event slug.
  IF NEW.plan != OLD.plan THEN
    v_event := 'plan_change';
  ELSIF NEW.status != OLD.status THEN
    v_event := 'status_' || NEW.status;
  ELSIF NEW.cancel_at_period_end AND NOT OLD.cancel_at_period_end THEN
    v_event := 'cancel_scheduled';
  ELSIF NOT NEW.cancel_at_period_end AND OLD.cancel_at_period_end THEN
    v_event := 'cancel_reverted';
  ELSE
    v_event := 'billing_cycle_change';
  END IF;

  PERFORM log_subscription_event(
    NEW.id, NEW.host_id, v_event,
    OLD.plan, NEW.plan,
    OLD.status, NEW.status,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_history_trigger ON subscriptions;
CREATE TRIGGER subscription_history_trigger
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_subscription_change();

-- Also seed the first history row when a brand-new subscription is
-- inserted (signup/host writes the row directly, no UPDATE path).
CREATE OR REPLACE FUNCTION public.on_subscription_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM log_subscription_event(
    NEW.id, NEW.host_id, 'created',
    NULL, NEW.plan,
    NULL, NEW.status,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_history_insert_trigger ON subscriptions;
CREATE TRIGGER subscription_history_insert_trigger
  AFTER INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_subscription_insert();
