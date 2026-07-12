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
      "id, reference, check_in, check_out, session_date, nights, guests_count, total_amount, currency, payment_method, guest_name, guest_email, eft_proof_url, host_id, property_id, guest_id",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !booking) return null;

  const [{ data: listing }, { data: host }, { data: guestUser }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, name, slug")
        .eq("id", booking.property_id)
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

const bookingForfeitedGuestResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const bundle = await loadBookingBundle(ctx.supabase, bookingId);
  if (!bundle) return {};
  const base = commonBookingProps(bundle);

  const { data: fs } = await ctx.supabase
    .from("forfeit_statements")
    .select(
      "statement_number, amount_paid, amount_forfeited, amount_refunded, currency, policy_applied",
    )
    .eq("booking_id", bookingId)
    .maybeSingle();

  const cur = fs?.currency ?? bundle.booking.currency;
  return {
    ...base,
    statementNumber: fs?.statement_number ?? null,
    amountPaid:
      fs?.amount_paid == null ? null : formatMoney(Number(fs.amount_paid), cur),
    amountForfeited:
      fs?.amount_forfeited == null
        ? null
        : formatMoney(Number(fs.amount_forfeited), cur),
    amountRefunded:
      fs?.amount_refunded == null || Number(fs.amount_refunded) <= 0
        ? null
        : formatMoney(Number(fs.amount_refunded), cur),
    policyApplied: (fs?.policy_applied as string | null) ?? null,
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

// ── Access details (the "your stay is almost here" email) ──────────
// Mirrors the send_due_access_cards() SQL cron: whole-listing access by
// default, or one block per booked room with per-field fallback to the
// listing defaults. Runs with the admin client, so it can read the secret
// property_access / property_room_access rows for the guest's own booking.
type AccessFields = {
  check_in_method: string | null;
  check_in_instructions: string | null;
  gate_code: string | null;
  door_code: string | null;
  wifi_network: string | null;
  wifi_password: string | null;
};

const ACCESS_COLS =
  "check_in_method, check_in_instructions, gate_code, door_code, wifi_network, wifi_password";

const cleanField = (v: string | null | undefined): string | undefined => {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > 0 ? t : undefined;
};

// room value wins when non-empty, else fall back to the listing default.
const fallback = (
  room: string | null | undefined,
  listing: string | null | undefined,
): string | undefined => cleanField(room) ?? cleanField(listing);

function toAccessBlock(
  src: Partial<AccessFields> | null,
  label?: string,
): Record<string, unknown> {
  return {
    ...(label ? { label } : {}),
    checkInMethod: cleanField(src?.check_in_method),
    checkInInstructions: cleanField(src?.check_in_instructions),
    gateCode: cleanField(src?.gate_code),
    doorCode: cleanField(src?.door_code),
    wifiNetwork: cleanField(src?.wifi_network),
    wifiPassword: cleanField(src?.wifi_password),
  };
}

const stayDetailsGuestResolver: EmailResolver = async (refs, ctx) => {
  const bookingId = refId(refs, "booking_id");
  if (!bookingId) return {};
  const bundle = await loadBookingBundle(ctx.supabase, bookingId);
  if (!bundle || !bundle.listing) return {};
  const supabase = ctx.supabase;
  const listingId = bundle.listing.id;
  const base = commonBookingProps(bundle);

  // Check-in time + a human "Where" line from the property.
  const { data: prop } = await supabase
    .from("properties")
    .select("check_in_time, address_line1, address_line2, city, province")
    .eq("id", listingId)
    .maybeSingle();

  const checkInTime =
    typeof prop?.check_in_time === "string"
      ? prop.check_in_time.slice(0, 5)
      : "your check-in time";
  const address =
    [prop?.address_line1, prop?.address_line2, prop?.city, prop?.province]
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .join(", ") || "Address shared by your host";

  // Listing-level access (the defaults every room falls back to).
  const { data: la } = await supabase
    .from("property_access")
    .select(ACCESS_COLS)
    .eq("property_id", listingId)
    .maybeSingle();
  const listingAccess = (la as AccessFields | null) ?? null;

  // Booked rooms → one access block each (per-field fallback to the listing).
  const { data: bookedRooms } = await supabase
    .from("booking_rooms")
    .select("room_id")
    .eq("booking_id", bookingId);
  const roomIds = (bookedRooms ?? [])
    .map((r) => r.room_id as string | null)
    .filter((id): id is string => !!id);

  let blocks: Record<string, unknown>[];
  if (roomIds.length > 0) {
    const [{ data: rooms }, { data: roomAccess }] = await Promise.all([
      supabase
        .from("property_rooms")
        .select("id, name, sort_order")
        .in("id", roomIds),
      supabase
        .from("property_room_access")
        .select(`room_id, ${ACCESS_COLS}`)
        .in("room_id", roomIds),
    ]);
    const raByRoom = new Map<string, AccessFields>();
    (roomAccess ?? []).forEach((ra) => {
      raByRoom.set((ra as { room_id: string }).room_id, ra as AccessFields);
    });
    blocks = (rooms ?? [])
      .slice()
      .sort(
        (a, b) =>
          ((a.sort_order as number | null) ?? 9999) -
            ((b.sort_order as number | null) ?? 9999) ||
          String(a.name).localeCompare(String(b.name)),
      )
      .map((room) => {
        const ra = raByRoom.get(room.id as string) ?? null;
        const merged: Partial<AccessFields> = {
          check_in_method: fallback(
            ra?.check_in_method,
            listingAccess?.check_in_method,
          ),
          check_in_instructions: fallback(
            ra?.check_in_instructions,
            listingAccess?.check_in_instructions,
          ),
          gate_code: fallback(ra?.gate_code, listingAccess?.gate_code),
          door_code: fallback(ra?.door_code, listingAccess?.door_code),
          wifi_network: fallback(ra?.wifi_network, listingAccess?.wifi_network),
          wifi_password: fallback(
            ra?.wifi_password,
            listingAccess?.wifi_password,
          ),
        };
        return toAccessBlock(merged, String(room.name));
      });
  } else {
    blocks = [toAccessBlock(listingAccess)];
  }

  return { ...base, checkInTime, address, blocks };
};

export const BOOKING_RESOLVERS: Record<string, EmailResolver> = {
  booking_request_host: bookingResolver,
  booking_confirmed_host: bookingConfirmedHostResolver,
  booking_confirmed_guest: bookingResolver,
  stay_details_guest: stayDetailsGuestResolver,
  booking_declined_guest: bookingResolver,
  booking_cancelled_host: bookingCancelledHostResolver,
  booking_cancelled_guest: bookingCancelledGuestResolver,
  booking_forfeited_guest: bookingForfeitedGuestResolver,
  eft_instructions_guest: eftInstructionsResolver,
  eft_proof_received_host: bookingResolver,
};
