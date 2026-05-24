"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import {
  createQuoteSchema,
  updateQuoteSchema,
  type CreateQuoteInput,
  type UpdateQuoteInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function assertOwnership(
  quoteId: string,
): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: quote } = await supabase
    .from("quotes")
    .select("host_id, host:hosts!inner ( user_id )")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };

  const ownerId = (quote as unknown as { host: { user_id: string } }).host
    .user_id;
  if (ownerId !== user.id) return { ok: false, error: "Not your quote." };
  return { ok: true, hostId: quote.host_id as string, userId: user.id };
}

async function getHostId(): Promise<
  { ok: true; hostId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };
  return { ok: true, hostId: host.id };
}

function totalsFor(input: {
  base_amount: number;
  cleaning_fee: number;
  addons: { quantity: number; unit_price: number }[];
}) {
  const addonsTotal = input.addons.reduce(
    (s, a) => s + a.quantity * a.unit_price,
    0,
  );
  const total = input.base_amount + input.cleaning_fee + addonsTotal;
  return { addonsTotal, total };
}

export async function createQuoteAction(
  input: CreateQuoteInput,
): Promise<ActionResult<{ id: string; quoteNumber: string }>> {
  const host = await getHostId();
  if (!host.ok) return host;

  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }

  const supabase = createServerClient();

  // Verify the listing belongs to this host (RLS will also enforce).
  const { data: listing } = await supabase
    .from("listings")
    .select("id, host_id")
    .eq("id", parsed.data.listing_id)
    .maybeSingle();
  if (!listing || listing.host_id !== host.hostId) {
    return { ok: false, error: "Listing not found." };
  }

  // Per-host quote number via SECURITY DEFINER RPC.
  const { data: numberResult, error: numberErr } = await supabase.rpc(
    "next_quote_number",
    { p_host_id: host.hostId },
  );
  if (numberErr || !numberResult) {
    return { ok: false, error: "Could not assign a quote number." };
  }

  const { addonsTotal, total } = totalsFor(parsed.data);

  const { data: quote, error: insErr } = await supabase
    .from("quotes")
    .insert({
      host_id: host.hostId,
      listing_id: parsed.data.listing_id,
      quote_number: numberResult as unknown as string,
      guest_name: parsed.data.guest_name,
      guest_email: parsed.data.guest_email,
      guest_phone: parsed.data.guest_phone || null,
      check_in: parsed.data.check_in,
      check_out: parsed.data.check_out,
      headcount: parsed.data.headcount,
      scope: parsed.data.scope,
      base_amount: parsed.data.base_amount,
      cleaning_fee: parsed.data.cleaning_fee,
      addons_total: addonsTotal,
      total_amount: total,
      currency: parsed.data.currency,
      notes: parsed.data.notes || null,
      status: "draft",
    })
    .select("id, quote_number")
    .single();
  if (insErr || !quote) {
    return { ok: false, error: "Could not save the quote." };
  }

  if (parsed.data.scope === "rooms" && parsed.data.rooms.length > 0) {
    const { error: roomsErr } = await supabase.from("quote_rooms").insert(
      parsed.data.rooms.map((r) => ({
        quote_id: quote.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
    if (roomsErr) {
      await supabase.from("quotes").delete().eq("id", quote.id);
      return { ok: false, error: "Could not save room selection." };
    }
  }

  if (parsed.data.addons.length > 0) {
    const { error: addonsErr } = await supabase.from("quote_addons").insert(
      parsed.data.addons.map((a, i) => ({
        quote_id: quote.id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        sort_order: i,
      })),
    );
    if (addonsErr) {
      await supabase.from("quotes").delete().eq("id", quote.id);
      return { ok: false, error: "Could not save add-ons." };
    }
  }

  revalidatePath("/dashboard/quotes");
  return {
    ok: true,
    data: { id: quote.id, quoteNumber: quote.quote_number as string },
  };
}

export async function updateQuoteAction(
  quoteId: string,
  input: UpdateQuoteInput,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const parsed = updateQuoteSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }

  const supabase = createServerClient();

  // Only drafts are editable.
  const { data: current } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!current || current.status !== "draft") {
    return { ok: false, error: "Only draft quotes can be edited." };
  }

  const { addonsTotal, total } = totalsFor(parsed.data);

  const { error: updErr } = await supabase
    .from("quotes")
    .update({
      listing_id: parsed.data.listing_id,
      guest_name: parsed.data.guest_name,
      guest_email: parsed.data.guest_email,
      guest_phone: parsed.data.guest_phone || null,
      check_in: parsed.data.check_in,
      check_out: parsed.data.check_out,
      headcount: parsed.data.headcount,
      scope: parsed.data.scope,
      base_amount: parsed.data.base_amount,
      cleaning_fee: parsed.data.cleaning_fee,
      addons_total: addonsTotal,
      total_amount: total,
      currency: parsed.data.currency,
      notes: parsed.data.notes || null,
    })
    .eq("id", quoteId);
  if (updErr) return { ok: false, error: "Could not save the quote." };

  // Replace rooms + addons (simple v1 approach).
  await supabase.from("quote_rooms").delete().eq("quote_id", quoteId);
  await supabase.from("quote_addons").delete().eq("quote_id", quoteId);

  if (parsed.data.scope === "rooms" && parsed.data.rooms.length > 0) {
    await supabase.from("quote_rooms").insert(
      parsed.data.rooms.map((r) => ({
        quote_id: quoteId,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
  }
  if (parsed.data.addons.length > 0) {
    await supabase.from("quote_addons").insert(
      parsed.data.addons.map((a, i) => ({
        quote_id: quoteId,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        sort_order: i,
      })),
    );
  }

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath("/dashboard/quotes");
  return { ok: true };
}

export async function sendQuoteAction(
  quoteId: string,
  validDays = 14,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: current } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Quote not found." };
  if (current.status !== "draft" && current.status !== "sent") {
    return { ok: false, error: "Only draft quotes can be sent." };
  }

  const validUntil = new Date(Date.now() + validDays * 86_400_000);
  const { error } = await supabase
    .from("quotes")
    .update({
      previous_status: current.status,
      status: "sent",
      sent_at: new Date().toISOString(),
      valid_until: validUntil.toISOString(),
    })
    .eq("id", quoteId);
  if (error) return { ok: false, error: "Could not send the quote." };

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath("/dashboard/quotes");
  return { ok: true };
}

export async function declineQuoteAction(
  quoteId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .in("status", ["draft", "sent"]);
  if (error) return { ok: false, error: "Could not decline the quote." };

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath("/dashboard/quotes");
  return { ok: true };
}

export async function markAcceptedAction(
  quoteId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("status", "sent");
  if (error) return { ok: false, error: "Could not mark accepted." };

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  return { ok: true };
}

export async function convertQuoteAction(
  quoteId: string,
  payment: { state: "paid" | "unpaid"; note?: string | null },
): Promise<ActionResult<{ bookingId: string }>> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Pull the full quote payload.
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, host_id, listing_id, guest_name, guest_email, guest_phone, guest_id,
      check_in, check_out, headcount, scope, base_amount, cleaning_fee,
      addons_total, total_amount, currency, status, notes
    `,
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };
  if (!["sent", "accepted"].includes(quote.status)) {
    return { ok: false, error: "Quote is not ready to convert." };
  }

  const { data: rooms } = await supabase
    .from("quote_rooms")
    .select("room_id, base_amount, cleaning_fee")
    .eq("quote_id", quoteId);

  const { data: addons } = await supabase
    .from("quote_addons")
    .select("label, quantity, unit_price, sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order");

  // Insert the booking.
  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      host_id: quote.host_id,
      listing_id: quote.listing_id,
      guest_id: quote.guest_id,
      guest_name: quote.guest_name,
      guest_email: quote.guest_email,
      guest_phone: quote.guest_phone,
      origin: "quote_converted",
      quote_id: quote.id,
      scope: quote.scope,
      check_in: quote.check_in,
      check_out: quote.check_out,
      guests_count: quote.headcount,
      base_amount: quote.base_amount,
      cleaning_fee: quote.cleaning_fee,
      total_amount: quote.total_amount,
      currency: quote.currency,
      payment_status: payment.state === "paid" ? "completed" : "pending",
      host_payment_note: payment.note || null,
      special_requests: quote.notes,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (bookErr || !booking) {
    return { ok: false, error: "Could not create the booking." };
  }

  if (quote.scope === "rooms" && rooms && rooms.length > 0) {
    await supabase.from("booking_rooms").insert(
      rooms.map((r) => ({
        booking_id: booking.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
  }

  if (addons && addons.length > 0) {
    await supabase.from("booking_addons").insert(
      addons.map((a) => ({
        booking_id: booking.id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        sort_order: a.sort_order,
      })),
    );
  }

  // Flip the quote to converted (trigger clears soft holds; on_booking_confirmed
  // trigger creates the invoice + locks the booking's calendar block).
  await supabase
    .from("quotes")
    .update({
      status: "converted",
      converted_at: new Date().toISOString(),
      converted_booking_id: booking.id,
    })
    .eq("id", quoteId);

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/calendar");
  return { ok: true, data: { bookingId: booking.id } };
}

export async function softDeleteQuoteAction(
  quoteId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: current } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Quote not found." };
  if (current.status === "converted") {
    return { ok: false, error: "Converted quotes can't be deleted." };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (error) return { ok: false, error: "Could not delete the quote." };

  revalidatePath("/dashboard/quotes");
  return { ok: true };
}
