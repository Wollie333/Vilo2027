/**
 * Documentation map: which reference keys a template's resolver reads from
 * `notification_queue.payload`. Used by the admin tool to show admins what
 * to put in the queue row when they wire up a new enqueue site.
 *
 * Stays in sync with the resolvers in `apps/web/lib/email/resolvers/`.
 */
export type RefSpec = {
  required: string[];
  optional?: string[];
  note?: string;
};

export const EXPECTED_REFS: Record<string, RefSpec> = {
  welcome_host: { required: ["host_id"] },

  booking_request_host: { required: ["booking_id"] },
  booking_confirmed_host: { required: ["booking_id"] },
  booking_confirmed_guest: { required: ["booking_id"] },
  booking_declined_guest: { required: ["booking_id"] },
  booking_cancelled_host: {
    required: ["booking_id"],
    optional: ["cancelled_by", "refund_amount"],
  },
  booking_cancelled_guest: {
    required: ["booking_id"],
    optional: ["cancelled_by", "refund_amount"],
  },

  eft_instructions_guest: {
    required: ["booking_id"],
    optional: ["expires_at"],
    note: "Bank details are read from the host's default eft_banking_details row.",
  },
  eft_proof_received_host: { required: ["booking_id"] },

  review_request_guest: {
    required: ["booking_id"],
    optional: ["review_url"],
  },
  new_review_host: { required: ["review_id"] },

  subscription_welcome: { required: ["subscription_id"] },
  subscription_expiring: {
    required: ["subscription_id"],
    optional: ["price"],
  },
  subscription_failed: {
    required: ["subscription_id"],
    optional: ["amount"],
  },
  subscription_restricted: { required: ["subscription_id"] },

  account_suspended: { required: ["host_id"] },

  refund_request_host: {
    required: ["refund_id"],
    optional: ["policy_entitlement", "response_deadline"],
  },
  refund_approved_guest: { required: ["refund_id"] },
  refund_declined_guest: {
    required: ["refund_id"],
    optional: ["decline_reason_label", "policy_summary"],
  },
  refund_completed_guest: { required: ["refund_id"] },
  refund_admin_override_host: {
    required: ["refund_id"],
    optional: ["admin_note"],
  },
  refund_escalated_admin: {
    required: ["refund_id", "recipient_email"],
    optional: ["escalation_note"],
    note: "recipient_email must be set on the queue row (custom recipient type — admin alert mailbox).",
  },
  eft_refund_sent_guest: {
    required: ["refund_id"],
    optional: ["host_note"],
  },

  staff_invite: {
    required: [
      "recipient_email",
      "inviteeFirstName",
      "hostName",
      "propertyName",
      "inviteToken",
    ],
    optional: ["expiresAt"],
    note: "No DB resolver — enqueue must supply every prop. Recipient type is custom (reads payload.recipient_email).",
  },
};

export function getRefSpec(type: string): RefSpec | null {
  return EXPECTED_REFS[type] ?? null;
}
