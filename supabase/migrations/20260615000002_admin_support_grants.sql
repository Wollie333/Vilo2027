-- Migration: host-consent support grants (Super-Admin portal)
--
-- The super admin can edit a host's NON-financial data directly, but financial
-- items (bookings, refunds, ledger) are read-only UNTIL the host approves a
-- time-boxed "support access" grant. Admin requests in-app → host approves in
-- their dashboard → a 72h edit window opens (auto-expires; host can revoke).

CREATE TABLE public.admin_support_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  host_user_id  uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  requested_by  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,  -- admin
  reason        text,
  status        text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'declined', 'revoked')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  expires_at    timestamptz,  -- set to now()+72h on approve
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_grants_host_user ON public.admin_support_grants(host_user_id, status);
CREATE INDEX idx_support_grants_host ON public.admin_support_grants(host_id, status);

ALTER TABLE public.admin_support_grants ENABLE ROW LEVEL SECURITY;

-- The host (owner) reads + decides on their own grants. Admin requests/reads via
-- the service-role client (RLS bypassed).
CREATE POLICY support_grants_host_read ON public.admin_support_grants
  FOR SELECT USING (host_user_id = auth.uid());
CREATE POLICY support_grants_host_update ON public.admin_support_grants
  FOR UPDATE USING (host_user_id = auth.uid());

COMMENT ON TABLE public.admin_support_grants IS
  'Host-approved, time-boxed permission for Vilo support to edit a host''s financial data. Default: financials read-only to admin.';
