import "server-only";

import type { PricingModel } from "@/app/[locale]/dashboard/addons/schemas";
import { notifyAdmins } from "@/lib/admin/notify";
import { mintPartyGuestIdentities } from "@/lib/bookings/mintPartyGuestIdentities";
import { notifyGuestEftInstructions } from "@/lib/bookings/notifyGuestEftInstructions";
import { notifyHostNewBooking } from "@/lib/bookings/notifyHostNewBooking";
import { postPaymentPendingCard } from "@/lib/messaging/system-card";
import {
  startBookingPayment,
  type PayableBooking,
} from "@/lib/payments/pay-booking";
import {
  hostAcceptsBookings,
  HOST_NOT_ACCEPTING_MESSAGE,
} from "@/lib/subscriptions/hostAccess";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// THE single persistence tail shared by every booking-creating action — the
// guest checkout (createBookingAction) AND the special checkout
// (createSpecialBookingAction). Pricing/validation differ per surface and stay
// in the caller; once a booking is fully priced, the mechanical sequence is
// identical: insert the booking → atomically claim any redemption → write the
// room/add-on children (reserving live stock) → snapshot policies → take payment
// through the ONE canonical path. A single reverse-order unwind stack rolls the
// whole thing back on any post-insert failure.
//
// Server-only, no client imports — safe to call from server actions.
// ─────────────────────────────────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>;

export type BookingRoomRow = {
  room_id: string;
  base_amount: number;
  cleaning_fee: number;
};

export type BookingAddonRow = {
  /** null = a non-catalog line (e.g. age extras) — never reserves stock. */
  addon_id: string | null;
  label: string;
  quantity: number;
  unit_price: number;
  pricing_model?: PricingModel | null;
  currency: string;
  is_required: boolean;
  subtotal: number;
  sort_order: number;
  /** Reserve live catalog stock for this row (released if the booking unwinds). */
  reserve?: boolean;
};

export type RedeemStep = {
  /**
   * Atomic claim run immediately after the booking row is created (coupon or
   * special quantity cap). A false return means nothing was claimed, so the
   * caller's bare booking row is deleted WITHOUT running `rollback`.
   */
  claim: (
    bookingId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Release what `claim` took if a LATER step fails (e.g. decrement a special's
   * redemptions_used). Omit when the claim's record cascades with the booking
   * delete (coupon redemptions FK the booking) — that preserves the original
   * createBookingAction behaviour exactly.
   */
  rollback?: (bookingId: string) => Promise<void>;
};

export type PersistBookingInput = {
  admin: Admin;
  /**
   * The full bookings insert payload. The caller owns every column (incl.
   * special_id / origin / booked_via / coupon_id) — persist only fills nothing.
   */
  bookingInsert: Record<string, unknown>;
  redeem?: RedeemStep;
  bookingRooms?: BookingRoomRow[];
  addons?: BookingAddonRow[];
  policy: { listingId: string; specialCancellationPolicyId?: string | null };
  /** Everything startBookingPayment needs except id/reference (filled here). */
  payable: Omit<PayableBooking, "id" | "reference">;
  payment: {
    method: "paystack" | "eft" | "paypal";
    amount?: "deposit" | "full";
    email: string;
    origin: string;
    /** A path, or a builder given the freshly-created booking id. */
    returnTo: string | ((bookingId: string) => string);
  };
};

export type PersistBookingResult =
  | { ok: false; error: string }
  | { ok: true; redirectTo: string; bookingId: string };

export async function persistBookingAndPay(
  input: PersistBookingInput,
): Promise<PersistBookingResult> {
  const { admin } = input;

  // 0. Subscription gate (authoritative backstop). EVERY guest booking-creating
  // surface — app checkout, marketplace deal, website special — funnels through
  // here, so a host whose membership has lapsed (restricted/paused/cancelled/
  // expired) can never receive a new booking through any channel. Host-manual
  // entry uses a different path and is intentionally not gated here.
  const gateHostId =
    (input.bookingInsert.host_id as string | null | undefined) ?? null;
  if (!(await hostAcceptsBookings(admin, gateHostId))) {
    return { ok: false, error: HOST_NOT_ACCEPTING_MESSAGE };
  }

  // 1. Insert the booking row. Read back the total/deposit AFTER insert — the
  // BEFORE INSERT VAT trigger (apply_booking_vat) grosses up total_amount when
  // the listing is VAT-registered, so the caller's pre-insert breakdown total is
  // ex-VAT. Payment must charge the DB (post-VAT) value, not the stale estimate.
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert(input.bookingInsert)
    .select("id, reference, total_amount, deposit_amount")
    .single();
  if (bookingErr || !booking) {
    return { ok: false, error: "Could not start your booking. Try again." };
  }

  // Reverse-order teardown for any post-insert failure. Every step is no-op-safe,
  // so running the whole stack is always correct: release reserved stock → drop
  // child rows → release the redemption claim → delete the booking.
  const reservedAddons: { addonId: string; qty: number }[] = [];
  const unwind = async () => {
    for (const r of reservedAddons) {
      await admin.rpc("release_addon_stock", {
        p_addon_id: r.addonId,
        p_qty: r.qty,
      });
    }
    await admin.from("booking_addons").delete().eq("booking_id", booking.id);
    await admin.from("booking_rooms").delete().eq("booking_id", booking.id);
    if (input.redeem?.rollback) await input.redeem.rollback(booking.id);
    await admin.from("bookings").delete().eq("id", booking.id);
  };

  // 2. Atomic redemption (coupon / special). A false claim took nothing — just
  // remove the bare booking row.
  if (input.redeem) {
    const claimed = await input.redeem.claim(booking.id);
    if (!claimed.ok) {
      await admin.from("bookings").delete().eq("id", booking.id);
      return { ok: false, error: claimed.error };
    }
  }

  // 3. booking_rooms (per-room scope).
  const rooms = input.bookingRooms ?? [];
  if (rooms.length > 0) {
    const { error } = await admin.from("booking_rooms").insert(
      rooms.map((r) => ({
        booking_id: booking.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
    if (error) {
      await unwind();
      return { ok: false, error: "Could not save room selection. Try again." };
    }
  }

  // 4. booking_addons (catalog-linked + non-catalog lines).
  const addons = input.addons ?? [];
  if (addons.length > 0) {
    const { error } = await admin.from("booking_addons").insert(
      addons.map((a) => ({
        booking_id: booking.id,
        addon_id: a.addon_id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        pricing_model: a.pricing_model ?? null,
        currency: a.currency,
        is_required: a.is_required,
        subtotal: a.subtotal,
        sort_order: a.sort_order,
      })),
    );
    if (error) {
      await unwind();
      return { ok: false, error: "Could not save add-ons. Try again." };
    }

    // 4a. Reserve live inventory for catalog add-ons flagged `reserve`. Sorted by
    // addon_id to keep the lock order stable across concurrent checkouts; a
    // shortfall rolls the whole booking back.
    const toReserve = addons
      .filter((a): a is BookingAddonRow & { addon_id: string } =>
        Boolean(a.reserve && a.addon_id),
      )
      .sort((x, y) => x.addon_id.localeCompare(y.addon_id));
    for (const a of toReserve) {
      const { data: reserved, error: resErr } = await admin.rpc(
        "reserve_addon_stock",
        { p_addon_id: a.addon_id, p_qty: a.quantity },
      );
      if (resErr || reserved !== true) {
        await unwind();
        return {
          ok: false,
          error: `Sorry — “${a.label}” just sold out. Adjust your add-ons and try again.`,
        };
      }
      reservedAddons.push({ addonId: a.addon_id, qty: a.quantity });
    }
  }

  // 5. Freeze the effective policies onto the booking. A special passes its
  // cancellation override so resolution is override → room → listing → host
  // default. The booking is NOT unwound on failure (the guest has completed a
  // valid checkout) — but the failure must be LOUD, never silent: a booking with
  // no cancellation snapshot loses all refund protection (the refund engine
  // falls back to 0%). Alert ops so it can be healed (re-running the snapshot
  // fn backfills any booking missing a cancellation row).
  const { error: snapErr } = await admin.rpc("snapshot_booking_policies", {
    p_booking_id: booking.id,
    p_listing_id: input.policy.listingId,
    ...(input.policy.specialCancellationPolicyId
      ? {
          p_special_cancellation_policy_id:
            input.policy.specialCancellationPolicyId,
        }
      : {}),
  });
  if (snapErr) {
    await notifyAdmins(admin, {
      category: "finance",
      kind: "policy_snapshot_failed",
      title: `Policy snapshot failed for ${booking.reference}`,
      body: `snapshot_booking_policies errored (${snapErr.message}). This booking has no frozen cancellation policy, so refunds will fall back to 0% until it is healed.`,
      hostId: (input.bookingInsert.host_id as string | null) ?? null,
      href: `/dashboard/bookings/${booking.id}`,
    });
  }

  // 6. Take payment through the ONE canonical path (host's own Paystack / EFT).
  const returnTo =
    typeof input.payment.returnTo === "function"
      ? input.payment.returnTo(booking.id)
      : input.payment.returnTo;
  const pay = await startBookingPayment({
    booking: {
      ...input.payable,
      id: booking.id,
      reference: booking.reference,
      // Use the trigger-adjusted (VAT-inclusive) figures from the inserted row so
      // the guest is charged exactly what the booking + invoice reconcile to.
      total_amount: Number(booking.total_amount),
      deposit_amount:
        booking.deposit_amount != null
          ? Number(booking.deposit_amount)
          : input.payable.deposit_amount,
    },
    method: input.payment.method,
    amount: input.payment.amount ?? "full",
    email: input.payment.email,
    origin: input.payment.origin,
    returnTo,
  });
  if (!pay.ok) {
    await unwind();
    return { ok: false, error: pay.error };
  }

  // 7. Notify the host of the new (still-pending) booking so they can manage it
  // before payment settles. Uniform across every creation path that funnels
  // through here — app checkout, website checkout and the deal page. Best-effort.
  await notifyHostNewBooking(admin, booking.id);

  // 8. Email an EFT-reserving guest their transfer instructions (host banking +
  // booking reference) so they can pay even after leaving the success page. The
  // helper no-ops for card bookings (status stays 'pending', not 'pending_eft').
  await notifyGuestEftInstructions(admin, booking.id);

  // 8a. Drop the "reserved — complete your EFT" pending card into the guest's
  // thread, so an EFT booking has an in-thread card from the start (parity with
  // the card/PayPal path, whose confirmed card lands in-thread). Self-gates to
  // pending_eft, so it no-ops for card/PayPal. Best-effort.
  await postPaymentPendingCard(admin, booking.id);

  // 9. Mint a Wielo guest account for every party guest on the booking
  // (BUSINESS_PRINCIPLES #1 rule 1 names this entry point). Uniform across every
  // creation path for the same reason as 7 and 8. Best-effort.
  await mintPartyGuestIdentities(admin, booking.id);

  return { ok: true, redirectTo: pay.redirectTo, bookingId: booking.id };
}
