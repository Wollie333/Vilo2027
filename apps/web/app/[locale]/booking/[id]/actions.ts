"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { notifyHostEftProof } from "@/lib/bookings/notifyHostEftProof";
import { startBookingPayment } from "@/lib/payments/pay-booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type PayResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export type UploadProofResult =
  | { ok: true; fileName: string }
  | { ok: false; error: string };

// Mirrors the `eft-proofs` bucket's own limits — a file that fails these would
// be rejected by storage anyway, but with an opaque error the guest can't act on.
const PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PROOF_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

/**
 * Guest uploads proof of their EFT transfer against a booking they own, so the
 * host can verify it and mark the payment received.
 *
 * The storage bucket, its RLS, both `eft_proof_url` columns, the host's viewer
 * and the `eft_proof_received_host` email all already existed — this is the
 * missing call site that connects them. The EFT instructions email has always
 * advertised an "Upload proof of payment" button pointing here.
 */
export async function uploadEftProofAction(
  bookingId: string,
  formData: FormData,
): Promise<UploadProofResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to upload your proof." };

  // RLS scopes to the guest's own bookings, so a row coming back is proof of
  // ownership (same predicate as the storage policy's guest_id = auth.uid()).
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, payment_status, payment_method")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.payment_status === "completed") {
    return { ok: false, error: "This booking is already paid." };
  }
  if (
    booking.payment_method !== "eft" &&
    booking.payment_method !== "manual_eft"
  ) {
    return { ok: false, error: "This booking isn’t paying by EFT." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > PROOF_MAX_BYTES) {
    return { ok: false, error: "That file is larger than 10MB." };
  }
  const ext = PROOF_MIME[file.type];
  if (!ext) {
    return { ok: false, error: "Upload a JPG, PNG or PDF." };
  }

  // Path MUST start with the booking id — both storage policies key on
  // (storage.foldername(name))[1]. There is no UPDATE/DELETE policy on the
  // bucket, so never re-use a name: each upload is a new object.
  const path = `${bookingId}/${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from("eft-proofs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "Upload failed. Try again." };

  // The bucket is PRIVATE, so this stores the object PATH (not a public URL) —
  // readers mint a short-lived signed URL.
  //
  // `pending_eft` → `pending_eft_review` is what moves the booking into the
  // host's "EFT in review" queue. The status has existed in the enum and in 16
  // UI surfaces since May but nothing ever set it, because nothing could upload
  // a proof. Only advance from pending_eft: a confirmed booking the guest is
  // re-uploading against must not be dragged backwards.
  await admin
    .from("bookings")
    .update({
      eft_proof_url: path,
      ...(booking.status === "pending_eft"
        ? { status: "pending_eft_review" }
        : {}),
    })
    .eq("id", bookingId);

  // A pending_eft booking has NO payments row yet — one is created when the host
  // records the payment — so this is a no-op at this point in the lifecycle. It
  // keeps an existing record in step when there is one; the host's own view of
  // the proof hangs off the booking (see dashboard/bookings/[id]).
  await admin
    .from("payments")
    .update({ eft_proof_url: path })
    .eq("booking_id", bookingId)
    .in("method", ["eft", "manual_eft"]);

  await notifyHostEftProof(admin, bookingId);

  revalidatePath(`/booking/${bookingId}/success`);
  return { ok: true, fileName: file.name };
}

// Initialize payment for an ALREADY-CREATED booking that the SIGNED-IN guest
// owns (e.g. one auto-created when they accepted a quote). The shared
// startBookingPayment core (lib/payments/pay-booking.ts) does the actual work —
// host-Paystack init, EFT fallback, ledger-aware amounts — so this and the
// public /pay/[token] link stay in lockstep. Returns a URL to navigate to.
export async function initializePaymentForBookingAction(
  bookingId: string,
  opts: {
    method: "paystack" | "eft" | "paypal";
    amount: "deposit" | "full";
  },
): Promise<PayResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Sign in to pay." };

  // RLS scopes to the guest's own bookings, so a row coming back is proof of
  // ownership.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, guest_id, property_id, reference, scope, status, payment_status, total_amount, deposit_amount, currency, listing:properties ( name, host_id )",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) {
    return { ok: false, error: "Booking not found." };
  }

  const listing = (
    Array.isArray(booking.listing) ? booking.listing[0] : booking.listing
  ) as { name: string; host_id: string } | null;
  if (!listing) return { ok: false, error: "Listing unavailable." };

  return startBookingPayment({
    booking: {
      id: booking.id,
      reference: booking.reference,
      scope: booking.scope,
      status: booking.status,
      payment_status: booking.payment_status,
      total_amount: booking.total_amount,
      deposit_amount: booking.deposit_amount,
      currency: booking.currency,
      guest_id: booking.guest_id,
      property_id: booking.property_id,
      listing_name: listing.name,
      host_id: listing.host_id,
    },
    method: opts.method,
    amount: opts.amount,
    email: user.email,
    origin: headers().get("origin") ?? "",
    returnTo: `/booking/${booking.id}/success`,
  });
}
