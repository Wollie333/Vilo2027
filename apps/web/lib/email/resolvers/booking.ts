import {
  firstName,
  formatDateLong,
  formatDateShort,
  formatDateTimeLong,
  formatMoney,
  guestDisplayName,
  maskAccountNumber,
} from "../formatters";

import type { AdminClient, EmailResolver } from "./types";
import { refId } from "./types";

type BookingBundle = {
  booking: {
    id: string;
    reference: string;
    check_in: string | null;
    check_out: string | null;
    session_date: string | null;
    nights: number | null;
    guests_count: number;
    total_amount: number;
    currency: string;
    payment_method: string | null;
    guest_name: string | null;
    guest_email: string | null;
    eft_proof_url: string | null;
  };
  listing: { id: string; name: string; slug: string | null } | null;
  host: {
    id: string;
    display_name: string;
    handle: string;
    user_id: string;
  } | null;
  hostUser: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  guestUser: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
};

async function loadBookingBundle(
  supabase: AdminClient,
  bookingId: string,
): Promise<BookingBundle | null> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, check_in, check_out, session_date, nights, guests_count, total_amount, currency, payment_method, guest_name, guest_email, eft_proof_url, host_id, listing_id, guest_id",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !booking) return null;

  const [{ data: listing }, { data: host }, { data: guestUser }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, name, slug")
        .eq("id", booking.listing_id)
        .maybeSingle(),
      supabase
        .from("hosts")
        .select("id, display_name, handle, user_id")
        .eq("id", booking.host_id)
        .maybeSingle(),
      booking.guest_id
        ? supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .eq("id", booking.guest_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const hostUser = host
    ? (
        await supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .eq("id", host.user_id)
          .maybeSingle()
      ).data
    : null;

  return {
    booking,
    listing: listing ?? null,
    host: host ?? null,
    hostUser: hostUser ?? null,
    guestUser: guestUser ?? null,
  };
}

function paymentMethodLabel(raw: string | null): string {
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

function commonBookingProps(b: BookingBundle): Record<string, unknown> {
  const guestFull = b.guestUser?.full_name ?? b.booking.guest_name ?? null;
  const hostFull = b.hostUser?.full_name ?? b.host?.display_name ?? null;
  const listingName = b.listing?.name ?? "your listing";
  return {
    listingName,
    bookingReference: b.booking.reference,
    bookingId: b.booking.id,
    checkIn: formatDateLong(b.booking.check_in ?? b.booking.session_date),
    checkOut: formatDateLong(b.booking.check_out),
    nights: b.booking.nights ?? 1,
    guests: b.booking.guests_count,
    totalAmount: formatMoney(b.booking.total_amount, b.booking.currency),
    paymentMethod: paymentMethodLabel(b.booking.payment_method),
    hostFirstName: firstName(hostFull),
    hostName: hostFull ?? "Your host",
    guestFirstName: firstName(guestFull),
    guestName: guestDisplayName(guestFull),
    guestEmail: b.guestUser?.email ?? b.booking.guest_email ?? "—",
  };
}

const bookingResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const bundle = await loadBookingBundle(ctx.supabase, bookingId);
  if (!bundle) return {};
  return commonBookingProps(bundle);
};

const bookingCancelledHostResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const bundle = await loadBookingBundle(ctx.supabase, bookingId);
  if (!bundle) return {};
  const base = commonBookingProps(bundle);
  return {
    ...base,
    cancelledBy: (refs.cancelled_by as string) ?? "guest",
    refundAmount:
      typeof refs.refund_amount === "number"
        ? formatMoney(refs.refund_amount as number, bundle.booking.currency)
        : null,
  };
};

const bookingCancelledGuestResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const bundle = await loadBookingBundle(ctx.supabase, bookingId);
  if (!bundle) return {};
  const base = commonBookingProps(bundle);
  return {
    ...base,
    cancelledBy: (refs.cancelled_by as string) ?? "host",
    refundAmount:
      typeof refs.refund_amount === "number"
        ? formatMoney(refs.refund_amount as number, bundle.booking.currency)
        : null,
  };
};

const eftInstructionsResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const bundle = await loadBookingBundle(ctx.supabase, bookingId);
  if (!bundle) return {};
  const base = commonBookingProps(bundle);

  let banking: {
    bankName: string;
    accountHolder: string;
    accountNumberMasked: string;
    branchCode: string;
  } | null = null;

  if (bundle.host) {
    const { data: detail } = await ctx.supabase
      .from("eft_banking_details")
      .select("bank_name, account_holder, account_number, branch_code")
      .eq("host_id", bundle.host.id)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();
    if (detail) {
      banking = {
        bankName: detail.bank_name,
        accountHolder: detail.account_holder,
        accountNumberMasked: maskAccountNumber(detail.account_number),
        branchCode: detail.branch_code,
      };
    }
  }

  // Booking holds for 48h from creation by default — surface via formatted
  // string. Resolver doesn't read created_at directly; the cron that
  // enqueues the email can pass `expires_at`.
  const expiresAt = refs.expires_at;
  return {
    ...base,
    ...(banking ?? {}),
    expiresAt:
      typeof expiresAt === "string" ? formatDateTimeLong(expiresAt) : "—",
    paymentReference: bundle.booking.reference,
  };
};

const bookingConfirmedHostResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const bundle = await loadBookingBundle(ctx.supabase, bookingId);
  if (!bundle) return {};
  return {
    ...commonBookingProps(bundle),
    checkInShort: formatDateShort(
      bundle.booking.check_in ?? bundle.booking.session_date,
    ),
  };
};

export const BOOKING_RESOLVERS: Record<string, EmailResolver> = {
  booking_request_host: bookingResolver,
  booking_confirmed_host: bookingConfirmedHostResolver,
  booking_confirmed_guest: bookingResolver,
  booking_declined_guest: bookingResolver,
  booking_cancelled_host: bookingCancelledHostResolver,
  booking_cancelled_guest: bookingCancelledGuestResolver,
  eft_instructions_guest: eftInstructionsResolver,
  eft_proof_received_host: bookingResolver,
};
