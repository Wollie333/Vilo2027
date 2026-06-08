-- Migration: Append-only finance audit log (host-scoped).
--
-- admin_audit_log is super-admin only. Money actions a HOST takes (record
-- payment, refund, credit note, add charge, void, …) need their own tamper-
-- evident trail — for disputes today and SOC2/compliance later. INSERT-only:
-- the ledger spine never rewrites history.

CREATE TABLE public.finance_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- e.g. payment.record, payment.mark_received, payment.void, refund.issue,
  -- refund.void, credit_note.issue, credit_note.void, charge.add, charge.void,
  -- credit.apply, period.close, period.reopen
  action      text NOT NULL,
  booking_id  uuid REFERENCES bookings(id) ON DELETE SET NULL,
  txn_id      text,        -- ledger Txn id (pay_/inv_/cn_/rf_) when applicable
  entity_type text,        -- payment | invoice | credit_note | refund | period
  entity_id   uuid,
  amount      numeric,
  currency    text,
  reason      text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_audit_host    ON finance_audit_log(host_id, created_at DESC);
CREATE INDEX idx_finance_audit_booking ON finance_audit_log(booking_id);

COMMENT ON TABLE public.finance_audit_log IS
  'Append-only audit trail of every host money action. INSERT-only — no UPDATE/DELETE.';

ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

-- Hosts read their own trail; staff with the host context can too.
CREATE POLICY "host_read_own_finance_audit" ON finance_audit_log FOR SELECT
  USING (host_id = get_my_host_id() OR host_id = get_my_host_id_as_staff());

CREATE POLICY "admin_read_finance_audit" ON finance_audit_log FOR SELECT
  USING (is_super_admin());

-- Writes happen only through the service-role admin client in server actions.
-- No INSERT/UPDATE/DELETE policy for normal roles = append-only via service role.
