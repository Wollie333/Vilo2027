-- Migration: Accounting period close (per host, per month).
--
-- Once a month's books are done, the host can CLOSE it. Closed months can't be
-- mutated (no new/voided transactions dated inside them) — you post a reversing
-- entry in the open period instead. This is what makes the ledger trustworthy
-- to an accountant. A row here = that month is closed; closing/reopening is
-- recorded in finance_audit_log.

CREATE TABLE public.accounting_periods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  period_month date NOT NULL,  -- first day of the closed month, e.g. 2026-06-01
  closed_by    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  closed_at    timestamptz NOT NULL DEFAULT now(),
  note         text,
  UNIQUE (host_id, period_month)
);

CREATE INDEX idx_accounting_periods_host ON accounting_periods(host_id, period_month);

COMMENT ON TABLE public.accounting_periods IS
  'A row = that host-month is closed; transactions dated inside it can no longer be created or voided. Reopen = delete the row (audited).';

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_read_own_periods" ON accounting_periods FOR SELECT
  USING (host_id = get_my_host_id() OR host_id = get_my_host_id_as_staff());

CREATE POLICY "admin_read_periods" ON accounting_periods FOR SELECT
  USING (is_super_admin());

-- Close / reopen happen only through the service-role admin client (server
-- action verifies host ownership), so no host-facing write policies.

-- The guard, callable from anywhere (server actions): is the host's month for a
-- given date still open?
CREATE OR REPLACE FUNCTION public.is_period_closed(p_host_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE host_id = p_host_id
      AND period_month = date_trunc('month', p_date)::date
  );
$$;

COMMENT ON FUNCTION public.is_period_closed(uuid, date) IS
  'True if the host has closed the accounting month containing p_date.';
