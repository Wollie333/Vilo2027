"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertFullHost as requireHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

export type AddBookingGuestResult = { ok: true } | { ok: false; error: string };

// Name + email are both required so the party member can become a real,
// contactable, deduped guest record (host_contacts is keyed by lower(email)).
const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});
export type AddBookingGuestInput = z.infer<typeof schema>;

// Add a guest to an existing booking's party. Appends to additional_guests then
// materialises the contact + relationship via the canonical RPC (same path the
// confirm trigger uses) — never a forked write.
export async function addBookingGuestAction(
  bookingId: string,
  input: AddBookingGuestInput,
): Promise<AddBookingGuestResult> {
  const host = await requireHost();
  if (!host.ok) return host;

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const v = parsed.data;

  const supabase = createServerClient();
  // RLS host_manage_own_bookings — the SELECT enforces ownership.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, additional_guests")
    .eq("id", bookingId)
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };

  const existing = (booking.additional_guests ?? []) as Array<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
  const emailLc = v.email.toLowerCase();
  if (existing.some((g) => (g?.email ?? "").trim().toLowerCase() === emailLc)) {
    return { ok: false, error: "That guest is already on this booking." };
  }

  const next = [
    ...existing,
    { name: v.name, email: v.email, ...(v.phone ? { phone: v.phone } : {}) },
  ];
  const { error } = await supabase
    .from("bookings")
    .update({ additional_guests: next })
    .eq("id", bookingId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not add the guest." };

  // Mint the standalone contact + lead↔guest relationship (idempotent).
  await supabase.rpc("materialize_booking_party", { p_booking_id: bookingId });

  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard/guests");
  return { ok: true };
}
