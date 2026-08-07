"use server";

import { revalidatePath } from "next/cache";

import { assertFullHost } from "@/lib/host/current";
import { postGuestSystemCard } from "@/lib/messaging/system-card";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  previewBookingUpdateCore,
  previewDateChangeCore,
  type UpdateSettlement,
} from "@/lib/bookings/change-dates-core";

import {
  changeBookingDatesAction,
  previewChangeDatesAction,
} from "./change-dates-actions";

const round2 = (n: number) => Math.round(n * 100) / 100;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Host responses to a guest's booking-change request (booking_requests). Approve
// a date change → reuse the tested preview+apply flow (which already fires
// booking_dates_changed_guest); approving/declining stamps the request and posts
// a system card into the guest thread so both sides + the activity timelines
// stay in sync.

type Result = { ok: true } | { ok: false; error: string };

type ReqRow = {
  id: string;
  booking_id: string;
  host_id: string;
  guest_id: string;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
};

async function loadOpenRequest(requestId: string): Promise<
  | {
      ok: true;
      hostId: string;
      userId: string;
      req: ReqRow;
      admin: ReturnType<typeof createAdminClient>;
    }
  | { ok: false; error: string }
> {
  const host = await assertFullHost();
  if (!host.ok) return { ok: false, error: host.error };
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("booking_requests")
    .select("id, booking_id, host_id, guest_id, type, status, payload")
    .eq("id", requestId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!req || req.host_id !== host.hostId) {
    return { ok: false, error: "Request not found." };
  }
  if (req.status !== "pending") {
    return { ok: false, error: "This request has already been actioned." };
  }
  return {
    ok: true,
    hostId: host.hostId,
    userId: host.userId,
    req: req as ReqRow,
    admin,
  };
}

async function cardBooking(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
) {
  const { data: b } = await admin
    .from("bookings")
    .select(
      "id, host_id, guest_id, property_id, quote_id, reference, listing:properties ( name )",
    )
    .eq("id", bookingId)
    .maybeSingle();
  return b;
}

// Notify the guest (bell + push) of the host's decision. Best-effort.
async function notifyGuest(
  admin: ReturnType<typeof createAdminClient>,
  booking: {
    guest_id: string | null;
    property_id?: string | null;
    listing?: { name: string } | { name: string }[] | null;
  },
  kind: "booking_change_approved_guest" | "booking_change_declined_guest",
  bookingId: string,
): Promise<void> {
  if (!booking.guest_id) return;
  const listingName =
    (
      (Array.isArray(booking.listing)
        ? booking.listing[0]
        : booking.listing) as { name: string } | null
    )?.name ?? undefined;
  try {
    await dispatchEvent({
      kind,
      recipientUserId: booking.guest_id,
      refs: { booking_id: bookingId, listing_name: listingName },
      supabase: admin,
    });
  } catch {
    // non-fatal
  }
}

export async function approveBookingChangeAction(
  requestId: string,
): Promise<Result> {
  const loaded = await loadOpenRequest(requestId);
  if (!loaded.ok) return loaded;
  const { req, admin } = loaded;

  if (req.type === "date_change") {
    const checkIn = String(req.payload?.check_in ?? "");
    const checkOut = String(req.payload?.check_out ?? "");
    const preview = await previewChangeDatesAction({
      bookingId: req.booking_id,
      checkIn,
      checkOut,
    });
    if (!preview.ok) return { ok: false, error: preview.error };
    if (!preview.available) {
      return {
        ok: false,
        error:
          "Those dates are no longer available — decline and suggest others.",
      };
    }
    const applied = await changeBookingDatesAction({
      bookingId: req.booking_id,
      checkIn,
      checkOut,
      total: preview.suggestedTotal ?? 0,
    });
    if (!applied.ok) return applied;
  }

  await admin
    .from("booking_requests")
    .update({
      status: "approved",
      actioned_at: new Date().toISOString(),
      actioned_by: loaded.userId,
    })
    .eq("id", req.id);

  const booking = await cardBooking(admin, req.booking_id);
  if (booking) {
    const body =
      req.type === "date_change"
        ? `✅ Your date change for ${booking.reference} was approved — your trip now runs ${String(
            req.payload?.check_in ?? "",
          )} → ${String(req.payload?.check_out ?? "")}.`
        : `✅ Your request to add ${String(
            req.payload?.full_name ?? "a guest",
          )} to ${booking.reference} was approved.`;
    await postGuestSystemCard(admin, booking, {
      systemEvent: "booking_change_approved",
      body,
      readByGuest: false,
      readByHost: true,
    });
    // A date change already notifies via booking_dates_changed_guest; only the
    // add-a-guest approval needs its own guest notification.
    if (req.type !== "date_change") {
      await notifyGuest(
        admin,
        booking,
        "booking_change_approved_guest",
        req.booking_id,
      );
    }
  }

  revalidatePath(`/dashboard/bookings/${req.booking_id}`);
  revalidatePath(`/portal/trips/${req.booking_id}`);
  return { ok: true };
}

// Host CONFIRMS a guest's update request and sends a price QUOTE. The whole flow
// lives on the booking: we price the change (seasonal, host-overridable `total`),
// store it in payload.quote and leave the request 'pending' — the guest sees the
// quote on their trip and accepts or declines. `settlement` decides how a
// reduction is returned (refund / credit / none); an increase is always 'charge'.
export async function quoteBookingChangeAction(
  requestId: string,
  input: { total: number; settlement: UpdateSettlement },
): Promise<Result> {
  const loaded = await loadOpenRequest(requestId);
  if (!loaded.ok) return loaded;
  const { req, admin } = loaded;

  const patch =
    req.type === "date_change"
      ? {
          checkIn: String(req.payload?.check_in ?? ""),
          checkOut: String(req.payload?.check_out ?? ""),
        }
      : {
          guestsCount: Number(req.payload?.guests_count ?? 0) || undefined,
        };

  const preview = await previewBookingUpdateCore(
    admin,
    req.booking_id,
    req.host_id,
    patch,
  );
  if (!preview.ok) return { ok: false, error: preview.error };
  if (!preview.available) {
    return {
      ok: false,
      error:
        "Those dates are no longer available — decline and suggest others.",
    };
  }

  const total = round2(Number(input.total));
  if (!(total >= 0)) return { ok: false, error: "Enter a valid price." };
  const delta = round2(total - preview.netPaid);
  // A reduction needs a settlement choice; an increase / no-change is a 'charge'.
  const settlement: UpdateSettlement = delta < 0 ? input.settlement : "charge";

  const quote = {
    ...(patch.checkIn
      ? { check_in: patch.checkIn, check_out: patch.checkOut }
      : {}),
    ...(patch.guestsCount ? { guests_count: patch.guestsCount } : {}),
    quoted_total: total,
    net_paid: preview.netPaid,
    delta,
    settlement,
    currency: preview.currency,
    priced_at: new Date().toISOString(),
  };
  const newPayload = { ...(req.payload ?? {}), quote };

  const { error } = await admin
    .from("booking_requests")
    .update({ payload: newPayload, updated_at: new Date().toISOString() })
    .eq("id", req.id);
  if (error) return { ok: false, error: "Couldn't send the quote." };

  const booking = await cardBooking(admin, req.booking_id);
  if (booking) {
    await postGuestSystemCard(admin, booking, {
      systemEvent: "booking_change_quoted",
      body: `💬 Your host sent a quote for your change to ${booking.reference}. Review and accept or decline from your trip.`,
      readByGuest: false,
      readByHost: true,
    });
  }

  revalidatePath(`/dashboard/bookings/${req.booking_id}`);
  revalidatePath(`/portal/trips/${req.booking_id}`);
  return { ok: true };
}

// Host declines the guest's requested dates but SUGGESTS alternatives. The request
// moves to 'countered' (ball back in the guest's court); the guest accepts or
// declines from their trip. Only valid for a date-change request. We check the
// suggested dates are free NOW so the guest doesn't hit a wall on accept.
export async function counterBookingChangeAction(
  requestId: string,
  input: { checkIn: string; checkOut: string; note?: string },
): Promise<Result> {
  const loaded = await loadOpenRequest(requestId);
  if (!loaded.ok) return loaded;
  const { req, admin } = loaded;

  if (req.type !== "date_change") {
    return {
      ok: false,
      error: "You can only suggest dates for a date-change request.",
    };
  }
  const checkIn = String(input.checkIn ?? "");
  const checkOut = String(input.checkOut ?? "");
  if (!ISO.test(checkIn) || !ISO.test(checkOut)) {
    return { ok: false, error: "Pick both dates." };
  }
  if (checkOut <= checkIn) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  const preview = await previewDateChangeCore(
    admin,
    req.booking_id,
    req.host_id,
    checkIn,
    checkOut,
  );
  if (!preview.ok) return { ok: false, error: preview.error };
  if (!preview.available) {
    return {
      ok: false,
      error: "Those dates clash with another booking or a block — pick others.",
    };
  }

  const note = input.note?.trim().slice(0, 500) || null;
  const nowIso = new Date().toISOString();
  const basePayload = (req.payload ?? {}) as Record<string, unknown>;
  await admin
    .from("booking_requests")
    .update({
      status: "countered",
      host_note: note,
      actioned_at: nowIso,
      actioned_by: loaded.userId,
      payload: {
        ...basePayload,
        counter: { check_in: checkIn, check_out: checkOut, at: nowIso },
      },
    })
    .eq("id", req.id);

  const booking = await cardBooking(admin, req.booking_id);
  if (booking) {
    await postGuestSystemCard(admin, booking, {
      systemEvent: "booking_change_countered",
      body: `📅 Your host suggested different dates for ${booking.reference}: ${checkIn} → ${checkOut}.${
        note ? ` “${note}”` : ""
      } Accept or decline from your trip.`,
      readByGuest: false,
      readByHost: true,
    });
    if (booking.guest_id) {
      const listingName =
        (
          (Array.isArray(booking.listing)
            ? booking.listing[0]
            : booking.listing) as { name: string } | null
        )?.name ?? undefined;
      try {
        await dispatchEvent({
          kind: "booking_change_countered_guest",
          recipientUserId: booking.guest_id,
          refs: {
            booking_id: req.booking_id,
            listing_name: listingName,
            check_in: checkIn,
            check_out: checkOut,
          },
          supabase: admin,
        });
      } catch {
        // non-fatal
      }
    }
  }

  revalidatePath(`/dashboard/bookings/${req.booking_id}`);
  revalidatePath(`/portal/trips/${req.booking_id}`);
  return { ok: true };
}

export async function declineBookingChangeAction(
  requestId: string,
  reason?: string,
): Promise<Result> {
  const loaded = await loadOpenRequest(requestId);
  if (!loaded.ok) return loaded;
  const { req, admin } = loaded;
  const note = reason?.trim().slice(0, 500) || null;

  await admin
    .from("booking_requests")
    .update({
      status: "declined",
      actioned_at: new Date().toISOString(),
      actioned_by: loaded.userId,
      decline_reason: note,
    })
    .eq("id", req.id);

  const booking = await cardBooking(admin, req.booking_id);
  if (booking) {
    const what =
      req.type === "date_change" ? "date change" : "request to add a guest";
    await postGuestSystemCard(admin, booking, {
      systemEvent: "booking_change_declined",
      body: `Your ${what} for ${booking.reference} wasn't approved${
        note ? ` — ${note}` : ""
      }. Message your host if you'd like to discuss options.`,
      readByGuest: false,
      readByHost: true,
    });
    await notifyGuest(
      admin,
      booking,
      "booking_change_declined_guest",
      req.booking_id,
    );
  }

  revalidatePath(`/dashboard/bookings/${req.booking_id}`);
  revalidatePath(`/portal/trips/${req.booking_id}`);
  return { ok: true };
}
