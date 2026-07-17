"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { sendVerificationEmail } from "@/lib/auth/verifyEmail";
import { createBookingCore } from "@/lib/bookings/createBooking";
import { resolveCoupon } from "@/lib/coupons";
import { nightsBetween, type ResolvedCoupon } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { type CreateBookingInput } from "./schemas";

export type CreateBookingResult = { ok: true } | { ok: false; error: string };

// ─── Live availability for the in-flow room picker (step 1) ───────
// Calls the SAME RPCs the booking action enforces with, via the admin client
// so anonymous visitors can check before creating an account. Read-only and
// non-sensitive (just which rooms are free for these dates).
const availabilitySchema = z.object({
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  room_ids: z.array(z.string().uuid()).max(50).default([]),
});
export type CheckAvailabilityInput = z.infer<typeof availabilitySchema>;
export type CheckAvailabilityResult =
  | { ok: true; whole: boolean; rooms: Record<string, boolean> }
  | { ok: false; error: string };

export async function checkAvailabilityAction(
  input: CheckAvailabilityInput,
): Promise<CheckAvailabilityResult> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid dates." };
  const { property_id, check_in, check_out, room_ids } = parsed.data;
  if (check_out <= check_in) return { ok: false, error: "Invalid dates." };

  const admin = createAdminClient();
  try {
    const [{ data: wholeData }, roomResults] = await Promise.all([
      admin.rpc("listing_is_available_whole", {
        p_listing_id: property_id,
        p_check_in: check_in,
        p_check_out: check_out,
      }),
      Promise.all(
        room_ids.map(async (rid) => {
          const { data } = await admin.rpc("room_is_available", {
            p_listing_id: property_id,
            p_room_id: rid,
            p_check_in: check_in,
            p_check_out: check_out,
          });
          return [rid, data !== false] as const;
        }),
      ),
    ]);
    return {
      ok: true,
      whole: wholeData !== false,
      rooms: Object.fromEntries(roomResults),
    };
  } catch {
    // On any error, don't block the guest — the booking action re-checks and is
    // the authoritative gate.
    return { ok: true, whole: true, rooms: {} };
  }
}

// ─── Guest account creation at checkout ──────────────────────────
// Lets an unauthenticated visitor create a guest account inline on the
// checkout page (mirrors app/signup/guest createGuestAccountAction): the
// admin client creates an auto-confirmed user, then we sign them in
// server-side so the very next createBookingAction call sees the session.
const checkoutAccountSchema = z.object({
  full_name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});
export type CheckoutAccountInput = z.infer<typeof checkoutAccountSchema>;

export async function createCheckoutGuestAccountAction(
  input: CheckoutAccountInput,
): Promise<CreateBookingResult> {
  const parsed = checkoutAccountSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const { full_name, email, password } = parsed.data;

  // If they're already signed in, nothing to do.
  const existing = createServerClient();
  const {
    data: { user: already },
  } = await existing.auth.getUser();
  if (already) return { ok: true };

  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        ok: false,
        error:
          "An account with this email already exists — sign in to finish booking.",
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }

  const supabase = createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return {
      ok: false,
      error: "Account created, but sign-in failed. Try signing in manually.",
    };
  }

  // Seed the name + guest role onto the (trigger-created) profile row.
  const {
    data: { user: newUser },
  } = await supabase.auth.getUser();
  if (newUser) {
    await supabase
      .from("user_profiles")
      .update({ full_name, role: "guest" })
      .eq("id", newUser.id);

    // GoTrue auto-confirms (see lib/auth/verifyEmail), so this email is the only
    // thing that ever proves the guest owns the inbox — and it's the address the
    // host's check-in details go to. The three /signup/* paths all send it; this
    // one didn't, so a guest who booked without an account was never asked to
    // confirm and `email_verified_at` stayed null forever.
    await sendVerificationEmail({
      userId: newUser.id,
      email,
      origin: headers().get("origin") ?? "",
      firstName: full_name.trim().split(/\s+/)[0] ?? null,
    });
  }

  return { ok: true };
}

// ─── Guest coupon preview ─────────────────────────────────────────
// Validates a code against the current stay so the checkout can show the
// discount before submitting. The booking action re-validates + re-prices
// authoritatively, so this is advisory only (never the source of the charge).
const validateCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a code.").max(40),
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  room_ids: z.array(z.string().uuid()).optional().default([]),
  addon_ids: z.array(z.string().uuid()).optional().default([]),
  accommodation_amount: z.number().min(0),
  addons_amount: z.number().min(0),
});
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export type ValidateCouponResult =
  | { ok: true; coupon: ResolvedCoupon; label: string }
  | { ok: false; error: string };

export async function validateCouponAction(
  input: ValidateCouponInput,
): Promise<ValidateCouponResult> {
  const parsed = validateCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid coupon code." };
  }
  const v = parsed.data;
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("properties")
    .select("id, host_id")
    .eq("id", v.property_id)
    .maybeSingle();
  if (!listing) return { ok: false, error: "This listing isn’t available." };

  // Signed-in guest (if any) so the per-guest cap can be pre-checked.
  const {
    data: { user },
  } = await createServerClient().auth.getUser();

  const res = await resolveCoupon(admin, {
    code: v.code,
    hostId: listing.host_id,
    listingId: listing.id,
    nights: nightsBetween(v.check_in, v.check_out),
    guestId: user?.id ?? null,
    roomIds: v.room_ids,
    addonIds: v.addon_ids,
    accommodationAmount: v.accommodation_amount,
    addonsAmount: v.addons_amount,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, coupon: res.resolved, label: res.label };
}

export async function createBookingAction(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  // 1. Auth — the app checkout requires a signed-in guest. The session-less
  // website checkout (/api/site-booking) resolves a lead instead; both then run
  // the SAME validate→price→persist→pay core (lib/bookings/createBooking).
  const userClient = createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, error: "Sign in to complete your booking." };
  }

  const result = await createBookingCore(
    input,
    { guestId: user.id, email: user.email },
    {
      origin: headers().get("origin") ?? "",
      returnTo: (bookingId) => `/booking/${bookingId}/success`,
    },
  );
  if (!result.ok) return { ok: false, error: result.error };

  // Card → Paystack checkout URL; EFT → the success page (awaiting-transfer).
  redirect(result.redirectTo);
}
