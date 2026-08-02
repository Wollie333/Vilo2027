"use server";

import { revalidatePath } from "next/cache";

import { assertFullHost } from "@/lib/host/current";
import { postGuestSystemCard } from "@/lib/messaging/system-card";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  changeBookingDatesAction,
  previewChangeDatesAction,
} from "./change-dates-actions";

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

async function loadOpenRequest(
  requestId: string,
): Promise<
  | {
      ok: true;
      hostId: string;
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
  return { ok: true, hostId: host.hostId, req: req as ReqRow, admin };
}

async function cardBooking(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
) {
  const { data: b } = await admin
    .from("bookings")
    .select("id, host_id, guest_id, property_id, quote_id, reference")
    .eq("id", bookingId)
    .maybeSingle();
  return b;
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
      actioned_by: loaded.hostId,
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
      actioned_by: loaded.hostId,
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
  }

  revalidatePath(`/dashboard/bookings/${req.booking_id}`);
  revalidatePath(`/portal/trips/${req.booking_id}`);
  return { ok: true };
}
