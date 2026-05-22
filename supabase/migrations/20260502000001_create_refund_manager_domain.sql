-- Migration: Domain 10 — Refund Manager (v1.1)
-- Per supabase_database.md §13
-- Tables: refund_requests, refund_status_history
-- (Created AFTER policy_manager because refund_requests.policy_snapshot_id FKs to policy_snapshots.)

-- ─── refund_requests ──────────────────────────────────────────
CREATE TABLE public.refund_requests (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

  booking_id          uuid    NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  payment_id          uuid    NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  host_id             uuid    NOT NULL REFERENCES hosts(id)    ON DELETE RESTRICT,
  guest_id            uuid    NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  requested_amount    numeric NOT NULL CHECK (requested_amount >= 0),
  approved_amount     numeric          CHECK (approved_amount >= 0),
  currency            text    NOT NULL DEFAULT 'ZAR',

  reason              text    NOT NULL,
  reason_detail       text,
  supporting_doc_url  text,

  initiated_by        text    NOT NULL DEFAULT 'guest'
                              CHECK (initiated_by IN ('guest','host','system','admin')),
  is_auto_refund      boolean NOT NULL DEFAULT false,
  auto_refund_rule    text,

  policy_snapshot_id  uuid    REFERENCES policy_snapshots(id) ON DELETE SET NULL,
  policy_entitlement  numeric,
  policy_name         text,

  status              text    NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending','approved','declined','processing',
                                'completed','failed','escalated','disputed','cancelled'
                              )),

  provider_refund_id  text,
  provider_response   jsonb,

  is_manual           boolean NOT NULL DEFAULT false,
  manual_sent_at      timestamptz,
  manual_note         text,
  guest_banking_details jsonb,

  host_note           text,
  decline_reason      text
                      CHECK (decline_reason IN (
                        'outside_policy','no_show','terms_violated',
                        'services_rendered','other'
                      )),
  actioned_by         uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  actioned_at         timestamptz,

  escalated_at        timestamptz,
  escalation_note     text,
  admin_decision      text
                      CHECK (admin_decision IN ('force_refund','uphold_decline')),
  admin_actioned_by   uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  admin_note          text,
  admin_actioned_at   timestamptz,

  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_req_booking ON refund_requests(booking_id);
CREATE INDEX idx_refund_req_payment ON refund_requests(payment_id);
CREATE INDEX idx_refund_req_host    ON refund_requests(host_id);
CREATE INDEX idx_refund_req_guest   ON refund_requests(guest_id);
CREATE INDEX idx_refund_req_status  ON refund_requests(status);
CREATE INDEX idx_refund_req_created ON refund_requests(created_at DESC);
CREATE INDEX idx_refund_req_host_pending ON refund_requests(host_id, status) WHERE status = 'pending';
CREATE INDEX idx_refund_req_escalated    ON refund_requests(escalated_at DESC) WHERE status = 'escalated';
CREATE INDEX idx_refund_req_auto         ON refund_requests(is_auto_refund)    WHERE is_auto_refund = true;
CREATE INDEX idx_refund_req_provider     ON refund_requests(provider_refund_id) WHERE provider_refund_id IS NOT NULL;

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- ─── refund_status_history (append-only) ──────────────────────
CREATE TABLE public.refund_status_history (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id uuid    NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
  from_status       text,
  to_status         text    NOT NULL,
  changed_by        uuid    REFERENCES user_profiles(id) ON DELETE SET NULL,
  changed_by_role   text,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_history_request ON refund_status_history(refund_request_id);
CREATE INDEX idx_refund_history_created ON refund_status_history(created_at DESC);

ALTER TABLE refund_status_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE refund_status_history IS
  'Immutable append-only log. One row per status transition on a refund_request. Never UPDATE or DELETE.';
