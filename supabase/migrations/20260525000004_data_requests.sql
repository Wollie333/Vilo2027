-- Migration: POPIA / GDPR data subject requests
--
-- Captures user requests to export their personal data or delete their
-- account. Actual fulfilment is manual today (founder processes the
-- queue) — this table is the audit trail + queue surface for admins.

CREATE TABLE public.data_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  request_type  text        NOT NULL CHECK (request_type IN ('export', 'deletion')),
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  notes         text,
  fulfilled_by  uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  fulfilled_at  timestamptz,
  rejected_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_requests_user      ON data_requests(user_id);
CREATE INDEX idx_data_requests_status    ON data_requests(status);
CREATE INDEX idx_data_requests_pending   ON data_requests(created_at DESC)
  WHERE status IN ('pending', 'processing');

ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE data_requests IS
  'POPIA / GDPR data subject access + erasure requests. INSERT by the user via the dashboard; admin processes manually.';

COMMENT ON COLUMN data_requests.fulfilled_by IS
  'Admin user id who processed the request. NULL until completed/rejected.';

-- RLS — users can insert and read their own; admins (via is_super_admin)
-- can read + update all rows.
CREATE POLICY "users_create_own_data_request"
  ON data_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_read_own_data_request"
  ON data_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_cancel_own_pending_data_request"
  ON data_requests FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status IN ('pending', 'cancelled'));

CREATE POLICY "admin_full_data_requests"
  ON data_requests FOR ALL
  USING (is_super_admin());

-- updated_at trigger (reuses the existing shared function)
CREATE TRIGGER set_data_requests_updated_at
  BEFORE UPDATE ON data_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
