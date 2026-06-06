"use server";

import { revalidatePath } from "next/cache";

import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { recomputeBookingPaymentState } from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { type AgeExtraLine } from "@/lib/pricing";
import { computeStayPricing } from "@/lib/pricing/quote";

import {
  createQuoteSchema,
  updateQuoteSchema,
  type CreateQuoteInput,
  type UpdateQuoteInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function nightsBetween(checkIn: string, checkOut: string): number {
  const f = new Date(`${checkIn}T00:00:00Z`).getTime();
  const t = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.round((t - f) / 86_400_000);
}

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

// Add a host-only internal note to a quote (quote_notes). Never shown to the
// guest — distinct from quotes.notes (the guest-facing message). RLS scopes the
// row to the owning host; we also assert ownership for a friendly error.
export async function addQuoteNoteAction(
  quoteId: string,
  body: string,
): Promise<ActionResult<{ id: string; body: string; created_at: string }>> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Note can't be empty." };
  if (text.length > 2000) {
    return { ok: false, error: "Note is too long (max 2000 characters)." };
  }

  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("quote_notes")
    .insert({ quote_id: quoteId, author_id: own.userId, body: text })
    .select("id, body, created_at")
    .single();
  if (error || !data) {
    return { ok: false, error: "Could not save note. Try again." };
  }

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  return { ok: true, data };
}

// Price a quote's accommodation through the canonical engine — the SAME path
// the guest checkout uses, so an auto-priced quote matches what a booking would
// charge for the same dates/rooms (seasonal + weekend aware). Add-ons are priced
// separately as quote lines. Host-only: the listing must belong to the caller.
export async function priceQuoteAction(input: {
  listing_id: string;
  check_in: string;
  check_out: string;
  scope: "whole_listing" | "rooms";
  guests: number;
  rooms: { room_id: string; guests: number }[];
  party?: { children: number; infants: number; pets: number };
}): Promise<
  ActionResult<{
    currency: string;
    nights: number;
    base_amount: number;
    cleaning_fee: number;
    total: number;
    rooms: { room_id: string; base_amount: number; cleaning_fee: number }[];
    age_lines: AgeExtraLine[];
    age_total: number;
  }>
> {
  const host = await getHostId();
  if (!host.ok) return host;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.check_in) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.check_out) ||
    nightsBetween(input.check_in, input.check_out) <= 0
  ) {
    return { ok: false, error: "Pick valid check-in and check-out dates." };
  }

  // Canonical pricing lives in the shared helper (also used by the public
  // enquiry flow) so an auto-priced quote matches a real booking.
  const admin = createAdminClient();
  const priced = await computeStayPricing(admin, input, host.hostId);
  if (!priced.ok) return priced;
  const d = priced.data;
  return {
    ok: true,
    data: {
      currency: d.currency,
      nights: d.nights,
      base_amount: d.base_amount,
      cleaning_fee: d.cleaning_fee,
      total: d.total,
      rooms: d.rooms,
      age_lines: d.age_lines,
      age_total: d.age_total,
    },
  };
}

function totalsFor(input: {
  base_amount: number;
  cleaning_fee: number;
  addons: { quantity: number; unit_price: number }[];
  discount_type?: "percent" | "fixed" | null;
  discount_value?: number;
}) {
  const addonsTotal = input.addons.reduce(
    (s, a) => s + a.quantity * a.unit_price,
    0,
  );
  const subtotal = input.base_amount + input.cleaning_fee + addonsTotal;
  // Discount applies to the whole subtotal and can't exceed it.
  let discountAmount = 0;
  const v = input.discount_value ?? 0;
  if (input.discount_type === "percent" && v > 0) {
    discountAmount = Math.round((subtotal * Math.min(v, 100)) / 100);
  } else if (input.discount_type === "fixed" && v > 0) {
    discountAmount = Math.min(v, subtotal);
  }
  const total = subtotal - discountAmount;
  return { addonsTotal, subtotal, discountAmount, total };
}

// Split the total into the deposit due to accept + the balance owed later.
function depositFor(
  total: number,
  type: "deposit" | "full" | "reserve" | undefined,
  pct: number | undefined,
) {
  if (type === "deposit") {
    const deposit = Math.round((total * Math.min(pct ?? 50, 100)) / 100);
    return { deposit, balance: total - deposit };
  }
  if (type === "reserve") return { deposit: 0, balance: total };
  return { deposit: total, balance: 0 }; // full
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
    .select("id, host_id, cancellation_policy, cancellation_policy_label")
    .eq("id", parsed.data.listing_id)
    .maybeSingle();
  if (!listing || listing.host_id !== host.hostId) {
    return { ok: false, error: "Listing not found." };
  }

  // Freeze the cancellation policy onto the quote so the terms the guest agreed
  // to never shift if the host re-policies the listing later. Carried onto the
  // booking's policy snapshot at convert time.
  const policySnapshot = {
    cancellation_policy: listing.cancellation_policy ?? null,
    cancellation_policy_label: listing.cancellation_policy_label ?? null,
    captured_at: new Date().toISOString(),
  };

  // Per-host quote number via SECURITY DEFINER RPC.
  const { data: numberResult, error: numberErr } = await supabase.rpc(
    "next_quote_number",
    { p_host_id: host.hostId },
  );
  if (numberErr || !numberResult) {
    return { ok: false, error: "Could not assign a quote number." };
  }

  const { addonsTotal, discountAmount, total } = totalsFor(parsed.data);
  const { deposit, balance } = depositFor(
    total,
    parsed.data.deposit_type,
    parsed.data.deposit_pct,
  );

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
      discount_type: parsed.data.discount_type ?? null,
      discount_value: parsed.data.discount_value ?? 0,
      discount_reason: parsed.data.discount_reason || null,
      discount_amount: discountAmount,
      deposit_type: parsed.data.deposit_type ?? "full",
      deposit_pct: parsed.data.deposit_pct ?? 50,
      deposit_amount: deposit,
      balance_amount: balance,
      balance_due_days: parsed.data.balance_due_days ?? 7,
      currency: parsed.data.currency,
      notes: parsed.data.notes || null,
      policy_snapshot: policySnapshot,
      guests_breakdown: parsed.data.guests_breakdown ?? null,
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
        addon_id: a.addon_id ?? null,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        kind: a.kind ?? (a.addon_id ? "catalog" : "custom"),
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

  // Draft + sent quotes are editable (a guest can ask to change something after
  // it's sent). Converted / declined / expired quotes are locked.
  const { data: current } = await supabase
    .from("quotes")
    .select("status, version")
    .eq("id", quoteId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Quote not found." };
  if (current.status !== "draft" && current.status !== "sent") {
    return {
      ok: false,
      error: "This quote can no longer be edited.",
    };
  }

  // Editing a quote that's already been sent snapshots the CURRENT (pre-edit)
  // state into quote_versions so the previously-issued quote — and the PDF that
  // can be regenerated from it — is preserved. Drafts edit in place.
  if (current.status === "sent") {
    await snapshotQuoteVersion(supabase, quoteId, current.version ?? 1);
  }

  const { addonsTotal, discountAmount, total } = totalsFor(parsed.data);
  const { deposit, balance } = depositFor(
    total,
    parsed.data.deposit_type,
    parsed.data.deposit_pct,
  );

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
      discount_type: parsed.data.discount_type ?? null,
      discount_value: parsed.data.discount_value ?? 0,
      discount_reason: parsed.data.discount_reason || null,
      discount_amount: discountAmount,
      deposit_type: parsed.data.deposit_type ?? "full",
      deposit_pct: parsed.data.deposit_pct ?? 50,
      deposit_amount: deposit,
      balance_amount: balance,
      balance_due_days: parsed.data.balance_due_days ?? 7,
      currency: parsed.data.currency,
      notes: parsed.data.notes || null,
      guests_breakdown: parsed.data.guests_breakdown ?? null,
      // Bump the live version when we snapshotted the prior one.
      version:
        current.status === "sent"
          ? (current.version ?? 1) + 1
          : (current.version ?? 1),
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
        addon_id: a.addon_id ?? null,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        kind: a.kind ?? (a.addon_id ? "catalog" : "custom"),
        sort_order: i,
      })),
    );
  }

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath("/dashboard/quotes");
  return { ok: true };
}

// Freeze the current quote (header + rooms + addons) into quote_versions so an
// edit never loses the previously-issued version. Best-effort — failure here
// shouldn't block the edit.
async function snapshotQuoteVersion(
  supabase: ReturnType<typeof createServerClient>,
  quoteId: string,
  versionNo: number,
): Promise<void> {
  const { data: q } = await supabase
    .from("quotes")
    .select(
      "quote_number, status, created_at, valid_until, guest_name, guest_email, guest_phone, check_in, check_out, headcount, scope, base_amount, cleaning_fee, addons_total, total_amount, currency, notes, listing:listings ( name )",
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (!q) return;

  const [{ data: rooms }, { data: addons }] = await Promise.all([
    supabase
      .from("quote_rooms")
      .select("room_id, base_amount, cleaning_fee")
      .eq("quote_id", quoteId),
    supabase
      .from("quote_addons")
      .select("addon_id, label, quantity, unit_price, subtotal, sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order"),
  ]);

  const listingName = Array.isArray(q.listing)
    ? (q.listing[0] as { name?: string } | undefined)?.name
    : (q.listing as { name?: string } | null)?.name;

  await supabase.from("quote_versions").insert({
    quote_id: quoteId,
    version_no: versionNo,
    total_amount: q.total_amount,
    currency: q.currency,
    snapshot: {
      ...q,
      listing_name: listingName ?? null,
      rooms: rooms ?? [],
      addons: addons ?? [],
    },
  });
}

// Advance the pipeline stage of the conversation a quote belongs to (if any),
// keeping the inbox pipeline in sync with quote events. Best-effort.
async function advanceConversationStage(
  supabase: ReturnType<typeof createServerClient>,
  quoteId: string,
  stage: "quote_sent" | "declined" | "accepted",
  postCard = false,
): Promise<void> {
  const { data: q } = await supabase
    .from("quotes")
    .select("conversation_id, quote_number, total_amount, currency")
    .eq("id", quoteId)
    .maybeSingle();
  if (!q?.conversation_id) return;
  await supabase
    .from("conversations")
    .update({ pipeline_stage: stage })
    .eq("id", q.conversation_id);
  if (postCard) {
    await supabase.from("messages").insert({
      conversation_id: q.conversation_id,
      sender_id: null,
      is_system_message: true,
      system_event: "quote_sent",
      quote_id: quoteId,
      body: `Quote ${q.quote_number} sent · ${formatMoney(Number(q.total_amount), q.currency)}`,
      read_by_host: true,
    });
  }
  revalidatePath("/dashboard/inbox");
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

  await advanceConversationStage(supabase, quoteId, "quote_sent", true);
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

  await advanceConversationStage(supabase, quoteId, "declined");
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

  await advanceConversationStage(supabase, quoteId, "accepted");
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
      addons_total, total_amount, currency, status, notes, guests_breakdown,
      discount_amount, deposit_amount, balance_amount, balance_due_days,
      converted_booking_id
    `,
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };

  // ── Idempotency guard ──────────────────────────────────────────────
  // A guest accept (lib/quotes/accept-convert.ts → acceptAndConvertQuote) may
  // have ALREADY created the booking for this quote and stamped
  // converted_booking_id while leaving the quote 'accepted'. Without this guard
  // the host's "convert" would mint a SECOND booking for the same quote — the
  // double-booking bug. Adopt the existing booking instead: confirm it if the
  // host is recording payment, finalise the quote, and return that booking id.
  if (quote.converted_booking_id) {
    const existingId = quote.converted_booking_id as string;
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, status, payment_status")
      .eq("id", existingId)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending" || existing.status === "pending_eft") {
        // Confirm the already-created booking (fires the calendar-block +
        // invoice triggers exactly once), mirroring the fresh-convert path.
        await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            payment_status:
              payment.state === "paid" ? "completed" : existing.payment_status,
            host_payment_note: payment.note || null,
          })
          .eq("id", existingId);
      } else if (
        payment.state === "paid" &&
        existing.payment_status !== "completed"
      ) {
        await supabase
          .from("bookings")
          .update({
            payment_status: "completed",
            host_payment_note: payment.note || null,
          })
          .eq("id", existingId);
      }

      await supabase
        .from("quotes")
        .update({
          status: "converted",
          converted_at: new Date().toISOString(),
          converted_booking_id: existingId,
        })
        .eq("id", quoteId)
        .neq("status", "converted");

      revalidatePath(`/dashboard/quotes/${quoteId}`);
      revalidatePath("/dashboard/quotes");
      revalidatePath("/dashboard/bookings");
      revalidatePath("/dashboard/invoices");
      revalidatePath("/dashboard/calendar");
      return { ok: true, data: { bookingId: existingId } };
    }
    // converted_booking_id points at a deleted booking — fall through and recreate.
  }

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

  // Insert the booking as PENDING first. The calendar-block + invoice triggers
  // are AFTER UPDATE OF status — they don't fire on an insert that's already
  // 'confirmed'. So we insert pending, attach rooms/add-ons, snapshot policies,
  // then UPDATE to confirmed (§ below) to fire both triggers exactly as a normal
  // booking would. Inserting straight to confirmed silently skips the invoice
  // and leaves the calendar un-blocked (double-booking risk).
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
      guests_breakdown: quote.guests_breakdown ?? null,
      discount_amount: quote.discount_amount ?? 0,
      deposit_amount: quote.deposit_amount ?? 0,
      // Outstanding balance + when it's due (check-in minus the agreed days).
      balance_due: quote.balance_amount ?? 0,
      balance_due_date:
        Number(quote.balance_amount ?? 0) > 0 && quote.check_in
          ? new Date(
              new Date(`${quote.check_in}T00:00:00Z`).getTime() -
                (quote.balance_due_days ?? 7) * 86_400_000,
            )
              .toISOString()
              .slice(0, 10)
          : null,
      base_amount: quote.base_amount,
      cleaning_fee: quote.cleaning_fee,
      total_amount: quote.total_amount,
      currency: quote.currency,
      payment_status: payment.state === "paid" ? "completed" : "pending",
      host_payment_note: payment.note || null,
      special_requests: quote.notes,
      status: "pending",
    })
    .select("id")
    .single();
  if (bookErr || !booking) {
    return { ok: false, error: "Could not create the booking." };
  }

  if (quote.scope === "rooms" && rooms && rooms.length > 0) {
    const { error: brErr } = await supabase.from("booking_rooms").insert(
      rooms.map((r) => ({
        booking_id: booking.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
    if (brErr) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return { ok: false, error: "Could not attach the booked rooms." };
    }
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

  // Seed the first ledger entry — the deposit. Payments have no host-write RLS,
  // so this goes through the service role. Marked received already when the host
  // says the deal is paid; otherwise pending for them to apply later.
  const admin = createAdminClient();
  const depositAmount = Number(quote.deposit_amount ?? 0);
  if (depositAmount > 0) {
    await admin.from("payments").insert({
      booking_id: booking.id,
      amount: depositAmount,
      currency: quote.currency,
      method: "eft",
      status: payment.state === "paid" ? "completed" : "pending",
      kind: "deposit",
      note:
        payment.note ||
        (payment.state === "paid"
          ? "Deposit received"
          : "Deposit to secure the booking"),
      captured_at: payment.state === "paid" ? new Date().toISOString() : null,
    });
  }
  await recomputeBookingPaymentState(admin, booking.id);

  // Carry the quote's frozen cancellation policy onto the booking so refund
  // maths (calculate_policy_refund_amount) has a snapshot to read. Best-effort.
  await supabase.rpc("snapshot_booking_policies", {
    p_booking_id: booking.id,
    p_listing_id: quote.listing_id,
  });

  // Confirm → fires on_booking_confirmed (blocks the calendar) and
  // on_booking_confirmed_create_invoice (mints the invoice, marked paid when the
  // payment is already completed). Rooms/add-ons are in place so the block trigger
  // scopes to the booked rooms.
  const { error: confirmErr } = await supabase
    .from("bookings")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", booking.id);
  if (confirmErr) {
    return { ok: false, error: "Booking created but could not be confirmed." };
  }

  // Flip the quote to converted (its on_quote_status_change trigger clears the
  // soft hold the send placed on these dates).
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

// Type-ahead over the host's past guests (from their bookings) so the quote
// builder can recognise a returning guest and pre-fill their details.
export async function searchGuestsAction(
  query: string,
): Promise<
  ActionResult<
    { name: string; email: string; phone: string | null; stays: number }[]
  >
> {
  const host = await getHostId();
  if (!host.ok) return host;
  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };

  const supabase = createServerClient();
  const { data: rows } = await supabase
    .from("bookings")
    .select("guest_name, guest_email, guest_phone, status")
    .eq("host_id", host.hostId)
    .or(`guest_name.ilike.%${q}%,guest_email.ilike.%${q}%`)
    .not("guest_email", "is", null)
    .limit(100);

  // Collapse to one entry per guest email, counting non-cancelled stays.
  const byEmail = new Map<
    string,
    { name: string; email: string; phone: string | null; stays: number }
  >();
  for (const r of rows ?? []) {
    const email = (r.guest_email ?? "").toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    const counts = !String(r.status ?? "").startsWith("cancelled");
    if (existing) {
      if (counts) existing.stays += 1;
      if (!existing.phone && r.guest_phone) existing.phone = r.guest_phone;
    } else {
      byEmail.set(email, {
        name: r.guest_name ?? "",
        email: r.guest_email ?? "",
        phone: r.guest_phone ?? null,
        stays: counts ? 1 : 0,
      });
    }
  }
  return {
    ok: true,
    data: [...byEmail.values()].sort((a, b) => b.stays - a.stays).slice(0, 6),
  };
}

// Post the quote link into an existing host↔guest conversation. Conversations
// are created by the booking/enquiry flow — we only write into one that already
// exists (matched on the guest's Vilo account). Account-less guests get a clear
// error so the host falls back to WhatsApp / email.
export async function shareQuoteToInboxAction(
  quoteId: string,
  acceptUrl: string,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("quote_number, guest_email, guest_id, total_amount, currency")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };

  // Resolve the guest's account — prefer the linked guest_id, else match email.
  let guestId = quote.guest_id as string | null;
  if (!guestId && quote.guest_email) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("email", quote.guest_email)
      .maybeSingle();
    guestId = profile?.id ?? null;
  }
  if (!guestId) {
    const brandName = await getBrandName();
    return {
      ok: false,
      error: `This guest has no ${brandName} account yet — use WhatsApp or email.`,
    };
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("host_id", own.hostId)
    .eq("guest_id", guestId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) {
    return {
      ok: false,
      error: "No inbox thread with this guest yet — use WhatsApp or email.",
    };
  }

  const body = `Here's your quote ${quote.quote_number} — ${formatMoney(
    quote.total_amount as number,
    quote.currency,
  )}. View and accept it here: ${acceptUrl}`;

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: own.userId,
    body,
    read_by_host: true,
  });
  if (error) return { ok: false, error: "Could not post to the inbox." };

  revalidatePath("/dashboard/inbox");
  return { ok: true };
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
