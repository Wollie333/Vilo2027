import {
  firstName,
  formatDateLong,
  formatMoney,
  guestDisplayName,
} from "../formatters";

import type { AdminClient, EmailResolver } from "./types";
import { refId } from "./types";

type RefundBundle = {
  refund: {
    id: string;
    amount: number;
    currency: string;
    booking_id: string;
    reason: string | null;
    is_manual: boolean;
    manual_note: string | null;
    status: string;
  };
  booking: {
    id: string;
    reference: string;
    check_in: string | null;
    total_amount: number;
    currency: string;
    payment_method: string | null;
    guest_name: string | null;
    property_id: string;
    host_id: string;
    guest_id: string | null;
  } | null;
  listing: { name: string } | null;
  host: { display_name: string; user_id: string } | null;
  hostUser: { full_name: string | null } | null;
  guestUser: { full_name: string | null } | null;
};

async function loadRefundBundle(
  supabase: AdminClient,
  refundId: string,
): Promise<RefundBundle | null> {
  // The canonical table is refund_requests (there is no `refunds` table). It has
  // no single `amount` column — use the approved figure once decided, else the
  // requested figure.
  const { data: row, error } = await supabase
    .from("refund_requests")
    .select(
      "id, requested_amount, approved_amount, currency, booking_id, reason, is_manual, manual_note, status",
    )
    .eq("id", refundId)
    .maybeSingle();
  if (error || !row) return null;
  const refund = {
    id: row.id,
    amount: Number(row.approved_amount ?? row.requested_amount),
    currency: row.currency,
    booking_id: row.booking_id,
    reason: row.reason,
    is_manual: row.is_manual,
    manual_note: row.manual_note,
    status: row.status,
  };

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, reference, check_in, total_amount, currency, payment_method, guest_name, property_id, host_id, guest_id",
    )
    .eq("id", refund.booking_id)
    .maybeSingle();

  let listing: { name: string } | null = null;
  let host: { display_name: string; user_id: string } | null = null;
  let hostUser: { full_name: string | null } | null = null;
  let guestUser: { full_name: string | null } | null = null;

  if (booking) {
    const [{ data: l }, { data: h }, { data: g }] = await Promise.all([
      supabase
        .from("properties")
        .select("name")
        .eq("id", booking.property_id)
        .maybeSingle(),
      supabase
        .from("hosts")
        .select("display_name, user_id")
        .eq("id", booking.host_id)
        .maybeSingle(),
      booking.guest_id
        ? supabase
            .from("user_profiles")
            .select("full_name")
            .eq("id", booking.guest_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    listing = l ?? null;
    host = h ?? null;
    guestUser = g ?? null;
    if (host) {
      const { data: hu } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", host.user_id)
        .maybeSingle();
      hostUser = hu ?? null;
    }
  }

  return { refund, booking, listing, host, hostUser, guestUser };
}

function paymentMethodLabel(raw: string | null | undefined): string {
  if (!raw) return "your original payment method";
  switch (raw) {
    case "paystack":
      return "your card via Paystack";
    case "paypal":
      return "your PayPal account";
    case "eft":
      return "the EFT account used";
    default:
      return "your original payment method";
  }
}

function processingNote(b: RefundBundle): string {
  if (b.booking?.payment_method === "eft" || b.refund.is_manual) {
    return "EFT transfers typically arrive within 1–2 business days.";
  }
  return "Allow 3–5 business days to appear in your account.";
}

function commonRefundProps(b: RefundBundle): Record<string, unknown> {
  const guestFull = b.guestUser?.full_name ?? b.booking?.guest_name ?? null;
  const hostFull = b.hostUser?.full_name ?? b.host?.display_name ?? null;
  const listingName = b.listing?.name ?? "the listing";
  const refundAmount = formatMoney(b.refund.amount, b.refund.currency);
  const totalPaid = b.booking
    ? formatMoney(b.booking.total_amount, b.booking.currency)
    : "—";
  return {
    listingName,
    bookingReference: b.booking?.reference ?? "—",
    bookingId: b.booking?.id ?? "",
    refundId: b.refund.id,
    refundAmount,
    totalPaid,
    requestedAmount: refundAmount,
    paymentMethod: paymentMethodLabel(b.booking?.payment_method),
    processingNote: processingNote(b),
    checkIn: formatDateLong(b.booking?.check_in),
    hostFirstName: firstName(hostFull),
    hostName: hostFull ?? "Host",
    guestFirstName: firstName(guestFull),
    guestName: guestDisplayName(guestFull),
    reason: b.refund.reason ?? "",
  };
}

const baseRefundResolver: EmailResolver = async (refs, ctx) => {
  const refundId = refId(refs, "refund_id");
  if (!refundId) return {};
  const bundle = await loadRefundBundle(ctx.supabase, refundId);
  if (!bundle) return {};
  return commonRefundProps(bundle);
};

const refundRequestHostResolver: EmailResolver = async (refs, ctx) => {
  const refundId = refId(refs, "refund_id");
  if (!refundId) return {};
  const bundle = await loadRefundBundle(ctx.supabase, refundId);
  if (!bundle) return {};
  const base = commonRefundProps(bundle);
  const policyEntitlement =
    typeof refs.policy_entitlement === "number"
      ? formatMoney(refs.policy_entitlement as number, bundle.refund.currency)
      : (base.refundAmount as string);
  return {
    ...base,
    policyEntitlement,
    responseDeadline:
      typeof refs.response_deadline === "string"
        ? refs.response_deadline
        : "72 hours",
  };
};

const refundDeclinedGuestResolver: EmailResolver = async (refs, ctx) => {
  const refundId = refId(refs, "refund_id");
  if (!refundId) return {};
  const bundle = await loadRefundBundle(ctx.supabase, refundId);
  if (!bundle) return {};
  return {
    ...commonRefundProps(bundle),
    declineReasonLabel:
      typeof refs.decline_reason_label === "string"
        ? refs.decline_reason_label
        : "Outside the cancellation policy window",
    policySummary:
      typeof refs.policy_summary === "string" ? refs.policy_summary : "",
  };
};

const refundAdminOverrideResolver: EmailResolver = async (refs, ctx) => {
  const refundId = refId(refs, "refund_id");
  if (!refundId) return {};
  const bundle = await loadRefundBundle(ctx.supabase, refundId);
  if (!bundle) return {};
  return {
    ...commonRefundProps(bundle),
    adminNote:
      typeof refs.admin_note === "string"
        ? refs.admin_note
        : (bundle.refund.manual_note ?? ""),
  };
};

const eftRefundSentResolver: EmailResolver = async (refs, ctx) => {
  const refundId = refId(refs, "refund_id");
  if (!refundId) return {};
  const bundle = await loadRefundBundle(ctx.supabase, refundId);
  if (!bundle) return {};
  return {
    ...commonRefundProps(bundle),
    hostNote:
      typeof refs.host_note === "string"
        ? refs.host_note
        : bundle.refund.manual_note,
    processingNote: "EFT transfers typically arrive within 1–2 business days.",
  };
};

export const REFUND_RESOLVERS: Record<string, EmailResolver> = {
  refund_request_host: refundRequestHostResolver,
  refund_approved_guest: baseRefundResolver,
  refund_declined_guest: refundDeclinedGuestResolver,
  refund_completed_guest: baseRefundResolver,
  refund_admin_override_host: refundAdminOverrideResolver,
  eft_refund_sent_guest: eftRefundSentResolver,
};
