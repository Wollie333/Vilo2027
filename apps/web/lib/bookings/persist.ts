import "server-only";

import type { Database } from "@vilo/types";

import type { PricingModel } from "@/app/[locale]/dashboard/addons/schemas";
import {
  startBookingPayment,
  type PayableBooking,
} from "@/lib/payments/pay-booking";
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

/**
 * The bookings insert payload. `reference` is omitted: a BEFORE INSERT trigger
 * (`trigger_gen_booking_reference`) generates it, so callers never supply it.
 */
type BookingInsert = Omit<
  Database["public"]["Tables"]["bookings"]["Insert"],
  "reference"
>;

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
  bookingInsert: BookingInsert;
  redeem?: RedeemStep;
  bookingRooms?: BookingRoomRow[];
  addons?: BookingAddonRow[];
  policy: { listingId: string; specialCancellationPolicyId?: string | null };
  /** Everything startBookingPayment needs except id/reference (filled here). */
  payable: Omit<PayableBooking, "id" | "reference">;
  payment: {
    method: "paystack" | "eft";
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

  // 1. Insert the booking row.
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    // reference is trigger-filled (see BookingInsert) — re-add it for the typed insert.
    .insert(
      input.bookingInsert as Database["public"]["Tables"]["bookings"]["Insert"],
    )
    .select("id, reference")
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

  // 5. Freeze the effective policies onto the booking (best-effort). A special
  // passes its cancellation override so resolution is override → room → listing →
  // host default.
  await admin.rpc("snapshot_booking_policies", {
    p_booking_id: booking.id,
    p_listing_id: input.policy.listingId,
    ...(input.policy.specialCancellationPolicyId
      ? {
          p_special_cancellation_policy_id:
            input.policy.specialCancellationPolicyId,
        }
      : {}),
  });

  // 6. Take payment through the ONE canonical path (host's own Paystack / EFT).
  const returnTo =
    typeof input.payment.returnTo === "function"
      ? input.payment.returnTo(booking.id)
      : input.payment.returnTo;
  const pay = await startBookingPayment({
    booking: { ...input.payable, id: booking.id, reference: booking.reference },
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

  return { ok: true, redirectTo: pay.redirectTo, bookingId: booking.id };
}
