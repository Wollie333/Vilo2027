"use server";

import { revalidatePath } from "next/cache";

import { getBrandName } from "@/lib/brand";
import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { formatMoney } from "@/lib/format";
import { requireHost as getHostId } from "@/lib/host/current";
import { isSelfRecipient, SELF_RECIPIENT_ERROR } from "@/lib/host/self";
import { dispatchEvent } from "@/lib/notifications/dispatch";
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
  property_id: string;
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

  if (
    await isSelfRecipient({
      userId: host.userId,
      recipientEmail: parsed.data.guest_email,
    })
  ) {
    return { ok: false, error: SELF_RECIPIENT_ERROR };
  }

  const supabase = createServerClient();

  // Verify the listing belongs to this host (RLS will also enforce).
  const { data: listing } = await supabase
    .from("properties")
    .select(
      "id, host_id, business_id, cancellation_policy, cancellation_policy_label",
    )
    .eq("id", parsed.data.property_id)
    .maybeSingle();
  if (!listing || listing.host_id !== host.hostId) {
    return { ok: false, error: "Listing not found." };
  }
  if (!listing.business_id) {
    return { ok: false, error: "Listing has no business assigned." };
  }

  // Freeze the cancellation policy onto the quote so the terms the guest agreed
  // to never shift if the host re-policies the listing later. Carried onto the
  // booking's policy snapshot at convert time.
  const policySnapshot = {
    cancellation_policy: listing.cancellation_policy ?? null,
    cancellation_policy_label: listing.cancellation_policy_label ?? null,
    captured_at: new Date().toISOString(),
  };

  // Per-business quote number via SECURITY DEFINER RPC.
  const { data: numberResult, error: numberErr } = await supabase.rpc(
    "next_quote_number",
    { p_business_id: listing.business_id },
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
      property_id: parsed.data.property_id,
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
      price_mode: parsed.data.price_mode ?? "itemised",
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
      looking_for_post_id: parsed.data.looking_for_post_id ?? null,
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
  // Required when revising an already-SENT quote: why it changed. Kept on the
  // superseded version's snapshot and shown on the revised-quote thread card.
  reason?: string,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const parsed = updateQuoteSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }

  if (
    await isSelfRecipient({
      userId: own.userId,
      recipientEmail: parsed.data.guest_email,
    })
  ) {
    return { ok: false, error: SELF_RECIPIENT_ERROR };
  }

  const supabase = createServerClient();

  // Draft + sent quotes are editable (a guest can ask to change something after
  // it's sent). Converted / declined / expired quotes are locked.
  const { data: current } = await supabase
    .from("quotes")
    .select("status, version, quote_number")
    .eq("id", quoteId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Quote not found." };
  if (current.status !== "draft" && current.status !== "sent") {
    return {
      ok: false,
      error: "This quote can no longer be edited.",
    };
  }

  // Revising an already-SENT quote needs a reason — the audit trail for why the
  // issued price changed (industry-standard estimate revision).
  const isRevision = current.status === "sent";
  if (isRevision && !(reason ?? "").trim()) {
    return {
      ok: false,
      error: "Add a short reason for revising this sent quote.",
    };
  }

  // Editing a quote that's already been sent snapshots the CURRENT (pre-edit)
  // state into quote_versions so the previously-issued quote — and the PDF that
  // can be regenerated from it — is preserved. Drafts edit in place.
  if (isRevision) {
    await snapshotQuoteVersion(supabase, quoteId, current.version ?? 1, reason);
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
      property_id: parsed.data.property_id,
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
      price_mode: parsed.data.price_mode ?? "itemised",
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

  // A revision of a sent quote posts its OWN card into the thread (the prior
  // version stays as a greyed, superseded card). Draft edits stay silent.
  if (isRevision) {
    const revisionReason = (reason ?? "").trim();
    await postQuoteEventCard(supabase, quoteId, "quote_revised", {
      body: `Quote ${current.quote_number ?? ""} revised · ${formatMoney(
        total,
        parsed.data.currency,
      )}${revisionReason ? ` · ${revisionReason}` : ""}`.trim(),
      versionNo: (current.version ?? 1) + 1,
      fromHost: true,
    });
  }

  revalidatePath(`/dashboard/quotes/${quoteId}`);
  revalidatePath("/dashboard/quotes");
  return { ok: true };
}

// Freeze the current quote (header + rooms + addons) into quote_versions so an
// edit never loses the previously-issued version. Best-effort — failure here
// shouldn't block the edit. `reason` records WHY this version was superseded.
async function snapshotQuoteVersion(
  supabase: ReturnType<typeof createServerClient>,
  quoteId: string,
  versionNo: number,
  reason?: string,
): Promise<void> {
  const { data: q } = await supabase
    .from("quotes")
    .select(
      "quote_number, status, created_at, valid_until, guest_name, guest_email, guest_phone, check_in, check_out, headcount, scope, base_amount, cleaning_fee, addons_total, total_amount, currency, notes, listing:properties ( name )",
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
    reason: reason?.trim() || null,
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
    .select("conversation_id, quote_number, total_amount, currency, version")
    .eq("id", quoteId)
    .maybeSingle();
  if (!q?.conversation_id) return;
  await supabase
    .from("conversations")
    .update({ pipeline_stage: stage })
    .eq("id", q.conversation_id);
  if (postCard) {
    // The official quote card — pinned to the version that was sent so the
    // thread can render it as a snapshot and grey it once it's superseded.
    await supabase.from("messages").insert({
      conversation_id: q.conversation_id,
      sender_id: null,
      is_system_message: true,
      system_event: "quote_sent",
      quote_id: quoteId,
      quote_version_no: q.version ?? 1,
      body: `Quote ${q.quote_number} sent · ${formatMoney(Number(q.total_amount), q.currency)}`,
      read_by_host: true,
      read_by_guest: false,
    });
  }
  revalidatePath("/dashboard/inbox");
}

// Post an immutable quote-lifecycle card into the quote's conversation thread
// (if it has one). Each transition is its OWN message — the thread renders one
// card per event (request / sent / revised / accepted / declined / converted),
// never a single mutating card. Host-initiated events are pre-read by the host;
// guest-initiated ones (a guest accept/decline) are left unread for the host so
// they surface in the inbox badge.
async function postQuoteEventCard(
  supabase: ReturnType<typeof createServerClient>,
  quoteId: string,
  event:
    | "quote_revised"
    | "quote_accepted"
    | "quote_declined"
    | "quote_converted",
  opts: { body: string; versionNo?: number | null; fromHost?: boolean },
): Promise<void> {
  const { data: q } = await supabase
    .from("quotes")
    .select("conversation_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!q?.conversation_id) return;
  const fromHost = opts.fromHost !== false;
  await supabase.from("messages").insert({
    conversation_id: q.conversation_id,
    sender_id: null,
    is_system_message: true,
    system_event: event,
    quote_id: quoteId,
    quote_version_no: opts.versionNo ?? null,
    body: opts.body,
    read_by_host: fromHost,
    read_by_guest: !fromHost,
  });
  revalidatePath("/dashboard/inbox");
}

export async function sendQuoteAction(
  quoteId: string,
  // Fallback only — QuoteForm always passes the host's chosen validity (its
  // presets are 1/3/7 days + "until check-in", default 3). Kept in sync with
  // that default so a quote never silently gets a different lifespan than the
  // builder showed. The expire-quotes cron (20260713140000) enforces it.
  validDays = 3,
): Promise<ActionResult> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  // Admin client — ownership is asserted above; a second createServerClient()
  // in the same request loses the auth session, so RLS reads would return null.
  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("quotes")
    // NB: quotes has `conversation_id` (its inbox thread), NOT `thread_id` — the
    // old select referenced a non-existent column, which errored the read and
    // silently aborted EVERY send (no quote ever reached 'sent').
    .select("status, looking_for_post_id, host_id, conversation_id")
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

  // If this quote is linked to a Looking For post, create/update the response record
  if (current.looking_for_post_id && current.host_id) {
    await supabase.from("looking_for_responses").upsert(
      {
        post_id: current.looking_for_post_id,
        host_id: current.host_id,
        quote_id: quoteId,
        thread_id: current.conversation_id,
        status: "sent",
        sent_at: new Date().toISOString(),
      },
      { onConflict: "post_id,host_id" },
    );

    // Record usage for quota tracking
    const host = await getHostId();
    if (host.ok) {
      await supabase.from("looking_for_usage").insert({
        user_id: host.userId,
        action: "host_quote",
        post_id: current.looking_for_post_id,
      });
    }

    // Notify the guest about the new quote — in-app + push AND the same
    // QuoteSentGuest email the general quote path sends (a Looking-For response
    // IS a quote). The email fields below are what that template renders; the
    // `looking_for_quote_received` EMAIL_REGISTRY entry maps back to it.
    const [{ data: postData }, { data: hostData }, { data: q }] =
      await Promise.all([
        supabase
          .from("looking_for_posts")
          .select(
            "title, guest_id, check_in_date, check_out_date, date_flexibility_days",
          )
          .eq("id", current.looking_for_post_id)
          .maybeSingle(),
        supabase
          .from("hosts")
          .select("display_name")
          .eq("id", current.host_id)
          .maybeSingle(),
        supabase
          .from("quotes")
          .select(
            "guest_name, check_in, check_out, total_amount, currency, quote_number, accept_token, property_id",
          )
          .eq("id", quoteId)
          .maybeSingle(),
      ]);

    let listingName: string | undefined;
    if (q?.property_id) {
      const { data: propRow } = await supabase
        .from("properties")
        .select("name")
        .eq("id", q.property_id)
        .maybeSingle();
      listingName = propRow?.name ?? undefined;
    }

    const fmtD = (iso: string | null): string =>
      iso
        ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
    // The guest's originally requested window (with their flexibility), shown on
    // the quote next to the host's quoted dates so the guest can see the match.
    const flexLbl = (d: number | null): string =>
      !d || d <= 0
        ? ""
        : d === 7
          ? " (± 1 week)"
          : d === 14
            ? " (± 2 weeks)"
            : ` (± ${d} day${d === 1 ? "" : "s"})`;
    const requestedDates =
      postData?.check_in_date && postData?.check_out_date
        ? `${fmtD(postData.check_in_date)} – ${fmtD(postData.check_out_date)}${flexLbl(postData.date_flexibility_days)}`
        : postData?.check_in_date
          ? `From ${fmtD(postData.check_in_date)}${flexLbl(postData.date_flexibility_days)}`
          : undefined;
    const nights =
      q?.check_in && q?.check_out
        ? Math.max(
            0,
            Math.round(
              (new Date(`${q.check_out}T00:00:00`).getTime() -
                new Date(`${q.check_in}T00:00:00`).getTime()) /
                86_400_000,
            ),
          )
        : 1;

    if (postData?.guest_id) {
      await dispatchEvent({
        kind: "looking_for_quote_received",
        recipientUserId: postData.guest_id,
        guestId: postData.guest_id,
        refs: {
          post_id: current.looking_for_post_id,
          quote_id: quoteId,
          post_title: postData.title ?? undefined,
          host_display_name: hostData?.display_name ?? undefined,
          // Fields the QuoteSentGuest email template renders:
          guestFirstName: (q?.guest_name ?? "").split(" ")[0] || undefined,
          listingName: listingName ?? postData.title ?? undefined,
          hostName: hostData?.display_name ?? undefined,
          checkIn: fmtD(q?.check_in ?? null),
          checkOut: fmtD(q?.check_out ?? null),
          requestedDates,
          nights,
          totalAmount: formatMoney(
            Number(q?.total_amount ?? 0),
            q?.currency ?? "ZAR",
          ),
          quoteNumber: q?.quote_number ?? undefined,
          validUntil: fmtD(validUntil.toISOString().slice(0, 10)),
          acceptToken: q?.accept_token ?? undefined,
        },
      });
    }

    revalidatePath("/dashboard/looking-for");
  } else {
    // Non-looking-for quote → email the guest a link to view & accept (the
    // general path; looking-for quotes use looking_for_quote_received). All
    // reads go through the admin client (RLS-safe, and keeps the status-update
    // path above untouched). We ensure the guest has a Wielo identity
    // (Principle #1) so there's always a notification recipient.
    const admin = createAdminClient();
    const { data: q } = await admin
      .from("quotes")
      .select(
        "guest_id, guest_name, guest_email, check_in, check_out, total_amount, currency, quote_number, accept_token, property_id",
      )
      .eq("id", quoteId)
      .maybeSingle();
    if (q?.guest_email) {
      let guestId = q.guest_id as string | null;
      if (!guestId) {
        const lead = await findOrCreateLeadIdentity(admin, {
          email: q.guest_email,
          name: q.guest_name ?? "",
        });
        guestId = lead?.guestId ?? null;
        if (guestId) {
          await admin
            .from("quotes")
            .update({ guest_id: guestId })
            .eq("id", quoteId)
            .is("guest_id", null);
        }
      }
      if (guestId) {
        const [{ data: hostRow }, { data: propRow }] = await Promise.all([
          admin
            .from("hosts")
            .select("display_name")
            .eq("id", current.host_id)
            .maybeSingle(),
          admin
            .from("properties")
            .select("name")
            .eq("id", q.property_id)
            .maybeSingle(),
        ]);
        const fmtD = (iso: string | null): string =>
          iso
            ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—";
        const nights =
          q.check_in && q.check_out
            ? Math.max(
                0,
                Math.round(
                  (new Date(`${q.check_out}T00:00:00`).getTime() -
                    new Date(`${q.check_in}T00:00:00`).getTime()) /
                    86_400_000,
                ),
              )
            : 1;
        await dispatchEvent({
          kind: "quote_sent_guest",
          recipientUserId: guestId,
          guestId,
          refs: {
            quoteId,
            guestFirstName: (q.guest_name ?? "").split(" ")[0] || undefined,
            listingName: propRow?.name ?? undefined,
            hostName: hostRow?.display_name ?? undefined,
            checkIn: fmtD(q.check_in),
            checkOut: fmtD(q.check_out),
            nights,
            totalAmount: formatMoney(
              Number(q.total_amount ?? 0),
              q.currency ?? "ZAR",
            ),
            quoteNumber: q.quote_number ?? undefined,
            validUntil: fmtD(validUntil.toISOString().slice(0, 10)),
            acceptToken: q.accept_token ?? undefined,
          },
        });
      }
    }
  }

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
  await postQuoteEventCard(supabase, quoteId, "quote_declined", {
    body: "Quote declined.",
    fromHost: true,
  });
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
  await postQuoteEventCard(supabase, quoteId, "quote_accepted", {
    body: "Quote marked accepted.",
    fromHost: true,
  });
  revalidatePath(`/dashboard/quotes/${quoteId}`);
  return { ok: true };
}

export async function convertQuoteAction(
  quoteId: string,
  // payNow overrides the deposit due now (host sets deposit / full / custom in
  // the convert modal); omitted → use the quote's saved deposit.
  payment: {
    state: "paid" | "unpaid";
    note?: string | null;
    payNow?: number | null;
  },
): Promise<ActionResult<{ bookingId: string }>> {
  const own = await assertOwnership(quoteId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Pull the full quote payload.
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, host_id, property_id, guest_name, guest_email, guest_phone, guest_id,
      check_in, check_out, headcount, scope, base_amount, cleaning_fee,
      addons_total, total_amount, currency, status, notes, guests_breakdown,
      discount_amount, deposit_amount, balance_amount, balance_due_days,
      converted_booking_id, conversation_id
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
            host_payment_note: payment.note || null,
          })
          .eq("id", existingId);
      }

      // Route payment through the ledger — the single source of truth — rather
      // than hand-setting payment_status. Otherwise the seeded deposit row stays
      // 'pending' and the booking flag contradicts the ledger (R0 paid).
      const admin = createAdminClient();
      // Honour a host-set pay-now amount even when adopting a guest-accepted
      // booking: re-point the pending deposit row + the booking deposit/balance
      // so the convert modal's Deposit/Full/Custom takes effect either way.
      if (payment.payNow != null) {
        const adoptTotal = Number(quote.total_amount ?? 0);
        const dueNow = Math.max(0, Math.min(payment.payNow, adoptTotal));
        await admin
          .from("payments")
          .update({ amount: dueNow })
          .eq("booking_id", existingId)
          .eq("status", "pending")
          .eq("kind", "deposit");
        await supabase
          .from("bookings")
          .update({
            deposit_amount: dueNow,
            balance_due: Math.round((adoptTotal - dueNow) * 100) / 100,
          })
          .eq("id", existingId);
      }
      if (payment.state === "paid") {
        // Complete ONLY the deposit row (the amount due now) — never sweep every
        // pending row to completed. "Paid" here means the host received the
        // pay-now amount, not the outstanding balance; an unscoped update would
        // over-credit a booking that has any other pending payment row (e.g. a
        // card-initiated one). Mirrors the fresh-convert path, which only ever
        // completes the deposit. The balance stays owed on bookings.balance_due.
        await admin
          .from("payments")
          .update({
            status: "completed",
            captured_at: new Date().toISOString(),
            note: payment.note || "Payment received",
          })
          .eq("booking_id", existingId)
          .eq("status", "pending")
          .eq("kind", "deposit");
      }
      await recomputeBookingPaymentState(admin, existingId);

      await supabase
        .from("quotes")
        .update({
          status: "converted",
          converted_at: new Date().toISOString(),
          converted_booking_id: existingId,
        })
        .eq("id", quoteId)
        .neq("status", "converted");

      // Link the booking to the thread so the inbox details panel shows it.
      if (quote.conversation_id) {
        await supabase
          .from("conversations")
          .update({ booking_id: existingId })
          .eq("id", quote.conversation_id);
      }

      await postQuoteEventCard(supabase, quoteId, "quote_converted", {
        body: "Quote converted to a booking.",
        fromHost: true,
      });
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

  // Deposit due now — the host's chosen amount (deposit / full / custom) when
  // provided, else the quote's saved deposit. The balance is whatever's left.
  const convTotal = Number(quote.total_amount ?? 0);
  const depositDue =
    payment.payNow != null
      ? Math.max(0, Math.min(payment.payNow, convTotal))
      : Number(quote.deposit_amount ?? 0);
  const balanceDue = Math.round((convTotal - depositDue) * 100) / 100;

  // Link the booking to the guest's account when one exists for this email
  // (email = canonical guest identity, BUSINESS_PRINCIPLES #1) so the converted
  // booking is visible in their portal / trips. A quote carries only an email
  // (no guest_id), so without this the booking lands with guest_id NULL and the
  // RLS-scoped /portal/trips page 404s for the guest who accepted it.
  let convGuestId = (quote.guest_id as string | null) ?? null;
  if (!convGuestId && quote.guest_email) {
    const { data: acct } = await createAdminClient()
      .from("user_profiles")
      .select("id")
      .ilike("email", quote.guest_email)
      .maybeSingle();
    convGuestId = acct?.id ?? null;
  }

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
      property_id: quote.property_id,
      guest_id: convGuestId,
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
      deposit_amount: depositDue,
      // Outstanding balance + when it's due (check-in minus the agreed days).
      balance_due: balanceDue,
      balance_due_date:
        balanceDue > 0 && quote.check_in
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
    const { error: aErr } = await supabase.from("booking_addons").insert(
      addons.map((a) => ({
        booking_id: booking.id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        subtotal:
          Math.round(Number(a.quantity) * Number(a.unit_price) * 100) / 100,
        sort_order: a.sort_order,
      })),
    );
    // Roll back the booking (rooms cascade) if add-ons fail — otherwise the
    // booking total would include line items that don't exist. Mirrors the
    // booking_rooms rollback above.
    if (aErr) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return { ok: false, error: "Could not attach the booking add-ons." };
    }
  }

  // Seed the first ledger entry — the deposit. Payments have no host-write RLS,
  // so this goes through the service role. Marked received already when the host
  // says the deal is paid; otherwise pending for them to apply later.
  const admin = createAdminClient();
  const depositAmount = depositDue;
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
    p_listing_id: quote.property_id,
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

  // Link the booking to the thread so the inbox details panel shows it.
  if (quote.conversation_id) {
    await supabase
      .from("conversations")
      .update({ booking_id: booking.id })
      .eq("id", quote.conversation_id);
  }

  await postQuoteEventCard(supabase, quoteId, "quote_converted", {
    body: "Quote converted to a booking.",
    fromHost: true,
  });
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
  // Search both past bookers AND the Guests CRM (host_contacts), so any guest
  // the host knows can be pulled in — not just ones who already have a booking.
  const safe = q.replace(/[%,()]/g, " ");
  const [{ data: rows }, { data: contacts }] = await Promise.all([
    supabase
      .from("bookings")
      .select("guest_name, guest_email, guest_phone, status")
      .eq("host_id", host.hostId)
      .or(`guest_name.ilike.%${safe}%,guest_email.ilike.%${safe}%`)
      .not("guest_email", "is", null)
      .limit(100),
    supabase
      .from("host_contacts")
      .select("name, email, phone")
      .eq("host_id", host.hostId)
      .or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
      .not("email", "is", null)
      .limit(100),
  ]);

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
  // Merge CRM contacts (no stay count of their own; fill gaps if already seen).
  for (const c of contacts ?? []) {
    const email = (c.email ?? "").toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    if (existing) {
      if (!existing.name && c.name) existing.name = c.name;
      if (!existing.phone && c.phone) existing.phone = c.phone;
    } else {
      byEmail.set(email, {
        name: c.name ?? "",
        email: c.email ?? "",
        phone: c.phone ?? null,
        stays: 0,
      });
    }
  }
  return {
    ok: true,
    data: [...byEmail.values()].sort((a, b) => b.stays - a.stays).slice(0, 8),
  };
}

// Post the quote link into an existing host↔guest conversation. Conversations
// are created by the booking/enquiry flow — we only write into one that already
// exists (matched on the guest's Wielo account). Account-less guests get a clear
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
