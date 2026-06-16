import { z } from "zod";

import { bindAffiliateReferral } from "@/lib/affiliate/attribution";
import { upsertHostContact } from "@/lib/guests/contacts";
import { isSelfRecipient } from "@/lib/host/self";
import type { StayPricingResult } from "@/lib/pricing/quote";
import { createAdminClient } from "@/lib/supabase/admin";

// Core logic for a public "request a quote" enquiry. Kept as a PLAIN server
// module (no "use server") so it can be invoked from a Route Handler, which —
// unlike a Server Action — controls its own response body and therefore lets
// the real error reach the client instead of being sanitised into an opaque
// 500. See app/api/enquiry/route.ts.
//
// A website visitor requests a quote from a listing. No login required: we
// find-or-create a passwordless guest "lead", open (or reuse) an enquiry
// conversation in the host's inbox at stage 'new_quote', and create a DRAFT
// quote (auto-priced as a suggestion) linked to that thread. The host then
// completes the host-only fields (price/fees/deposit/policy) and sends it back.
// Runs with the service role (the visitor is anonymous); never trusts pricing.
//
// The pricing engine, email sender (resend) and notification dispatcher are all
// imported DYNAMICALLY inside the function, never at module scope, so a heavy
// module that fails to load on the server degrades gracefully instead of
// crashing the whole request.

export const guestQuoteRequestSchema = z
  .object({
    listing_id: z.string().uuid(),
    scope: z.enum(["whole_listing", "rooms"]).default("whole_listing"),
    room_ids: z.array(z.string().uuid()).max(50).default([]),
    check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a check-in date."),
    check_out: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a check-out date."),
    guests_breakdown: z.object({
      adults: z.coerce.number().int().min(1).max(100).default(1),
      children: z.coerce.number().int().min(0).max(100).default(0),
      infants: z.coerce.number().int().min(0).max(100).default(0),
      pets: z.coerce.number().int().min(0).max(100).default(0),
    }),
    // Optional — a guest shouldn't be blocked from reaching the host over a
    // message-length rule. We default an empty note to a sensible line below.
    message: z.string().trim().max(2000).optional().default(""),
    guest_name: z.string().trim().min(2, "Enter your name.").max(120),
    guest_email: z.string().trim().email("Enter a valid email."),
    guest_phone: z.string().trim().max(40).optional().or(z.literal("")),
    // Honeypot — real users leave this empty; bots fill it. Permissive on the
    // schema (a filled value must NOT fail validation, or browser autofill would
    // block a real guest) — the silent-drop check below handles a filled value.
    hp: z.string().optional(),
  })
  .refine((v) => v.check_out > v.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  })
  .refine((v) => v.scope !== "rooms" || v.room_ids.length > 0, {
    message: "Pick at least one room.",
    path: ["room_ids"],
  });

export type GuestQuoteRequestInput = z.infer<typeof guestQuoteRequestSchema>;

export type RequestQuoteResult =
  | {
      ok: true;
      data: {
        isLead: boolean;
        email: string;
        conversationId?: string;
        // Where to send the guest next: a magic-link URL that signs a new lead
        // in and lands them on the claim screen, or a login URL for an existing
        // account. Absent for silently-dropped requests (honeypot / rate-limit).
        redirectTo?: string;
      };
    }
  | { ok: false; error: string };

function minutesOfDay(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

// Is "now" within the host's notification quiet-hours window (in their tz)?
// Handles same-day and overnight windows. Best-effort — false on any error.
function isWithinQuietHours(
  s: {
    quiet_hours_enabled: boolean | null;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    quiet_hours_timezone: string | null;
  } | null,
): boolean {
  if (!s?.quiet_hours_enabled) return false;
  const start = minutesOfDay(s.quiet_hours_start);
  const end = minutesOfDay(s.quiet_hours_end);
  if (start == null || end == null || start === end) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: s.quiet_hours_timezone || "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const now = h * 60 + m;
    return start < end ? now >= start && now < end : now >= start || now < end;
  } catch {
    return false;
  }
}

export async function createEnquiry(
  input: unknown,
): Promise<RequestQuoteResult> {
  const parsed = guestQuoteRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const d = parsed.data;

  // Honeypot tripped → pretend success, create nothing.
  const emailLc = d.guest_email.trim().toLowerCase();
  if (d.hp && d.hp.trim().length > 0) {
    return { ok: true, data: { isLead: false, email: emailLc } };
  }

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select(
      "id, host_id, business_id, name, currency, is_published, is_suspended, deleted_at, cancellation_policy, cancellation_policy_label",
    )
    .eq("id", d.listing_id)
    .maybeSingle();
  if (
    !listing ||
    !listing.is_published ||
    listing.is_suspended ||
    listing.deleted_at
  ) {
    return {
      ok: false,
      error: "This listing isn't accepting requests right now.",
    };
  }

  const { data: hostRow } = await admin
    .from("hosts")
    .select("id, user_id, display_name, enquiry_auto_reply")
    .eq("id", listing.host_id)
    .maybeSingle();
  if (!hostRow) return { ok: false, error: "Host unavailable." };

  // A host can't enquire on their own listing (that would open a thread with
  // themselves). Matched by email = the host's own account email.
  if (
    await isSelfRecipient({
      userId: hostRow.user_id,
      recipientEmail: emailLc,
    })
  ) {
    return {
      ok: false,
      error: "You can't send an enquiry to your own listing.",
    };
  }

  // Light rate-limit: cap enquiries from one email to this host per hour so a
  // single visitor can't flood the host. Silently absorb extras.
  const { count: recentCount } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("host_id", listing.host_id)
    .eq("guest_email", emailLc)
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((recentCount ?? 0) >= 5) {
    return { ok: true, data: { isLead: false, email: emailLc } };
  }

  // Existing contact? (also carries the block flag.)
  const { data: contact } = await admin
    .from("host_contacts")
    .select("id, blocked")
    .eq("host_id", listing.host_id)
    .ilike("email", emailLc)
    .maybeSingle();
  // Blocked sender → silently drop (don't reveal the block).
  if (contact?.blocked)
    return { ok: true, data: { isLead: false, email: emailLc } };

  // Find-or-create the guest. A new one is a passwordless lead (is_lead=true)
  // — NOT signed in; they can claim the account later by setting a password.
  let guestId: string;
  let isLead = false;
  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id, is_lead")
    .ilike("email", emailLc)
    .maybeSingle();
  if (existingProfile) {
    guestId = existingProfile.id;
    isLead = existingProfile.is_lead ?? false;
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: emailLc,
        email_confirm: true,
        user_metadata: { full_name: d.guest_name },
      });
    if (createErr || !created.user) {
      return { ok: false, error: "Could not start your request. Try again." };
    }
    guestId = created.user.id;
    isLead = true;
    await admin
      .from("user_profiles")
      .update({
        full_name: d.guest_name,
        phone: d.guest_phone || null,
        role: "guest",
        is_lead: true,
      })
      .eq("id", guestId);
    // A newly-minted lead is also a new Vilo account — attribute it to a
    // referring affiliate if a vilo_ref cookie is set on this request.
    await bindAffiliateReferral(guestId);
  }

  // Upsert the host's contact row through the one canonical writer (find-or-
  // update by email, back-fill guest_id, never duplicate). Fill-only so a lead's
  // enquiry can't clobber a name/phone the host already curated.
  await upsertHostContact(admin, {
    hostId: listing.host_id,
    email: emailLc,
    name: d.guest_name,
    phone: d.guest_phone || null,
    guestId,
    lastStage: "new_quote",
  });

  // Find-or-create the enquiry conversation.
  let conversationId: string;
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", listing.host_id)
    .eq("guest_id", guestId)
    .eq("listing_id", listing.id)
    .eq("is_enquiry", true)
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (conv) {
    conversationId = conv.id;
  } else {
    const { data: newConv, error: convErr } = await admin
      .from("conversations")
      .insert({
        host_id: listing.host_id,
        guest_id: guestId,
        listing_id: listing.id,
        is_enquiry: true,
        status: "open",
        pipeline_stage: "new_quote",
      })
      .select("id")
      .single();
    if (convErr || !newConv) {
      return { ok: false, error: "Could not start the conversation." };
    }
    conversationId = newConv.id;
  }

  // Suggested pricing (best-effort — the host finalises host-only fields).
  const headcount = Math.max(
    1,
    d.guests_breakdown.adults + d.guests_breakdown.children,
  );
  const roomCount = d.scope === "rooms" ? d.room_ids.length : 0;
  const roomsInput =
    d.scope === "rooms"
      ? d.room_ids.map((id) => ({
          room_id: id,
          guests: Math.max(1, Math.ceil(headcount / Math.max(1, roomCount))),
        }))
      : [];
  let priced: StayPricingResult = { ok: false, error: "pricing-unavailable" };
  try {
    const { computeStayPricing } = await import("@/lib/pricing/quote");
    priced = await computeStayPricing(admin, {
      listing_id: listing.id,
      check_in: d.check_in,
      check_out: d.check_out,
      scope: d.scope,
      guests: headcount,
      rooms: roomsInput,
      party: {
        children: d.guests_breakdown.children,
        infants: d.guests_breakdown.infants,
        pets: d.guests_breakdown.pets,
      },
    });
  } catch {
    // Pricing is a best-effort suggestion — the host finalises it. Fall back
    // to a zero-priced draft rather than failing the whole enquiry.
    priced = { ok: false, error: "pricing-unavailable" };
  }
  const baseAmount = priced.ok ? priced.data.base_amount : 0;
  const cleaningFee = priced.ok ? priced.data.cleaning_fee : 0;
  const ageTotal = priced.ok ? priced.data.age_total : 0;
  const total = baseAmount + cleaningFee + ageTotal;
  const currency = priced.ok
    ? priced.data.currency
    : (listing.currency ?? "ZAR");

  // Per-business quote number (listings always carry a business_id post-Phase 1;
  // guard anyway — a null number is tolerated below).
  const { data: qnum } = listing.business_id
    ? await admin.rpc("next_quote_number", {
        p_business_id: listing.business_id,
      })
    : { data: null };

  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .insert({
      host_id: listing.host_id,
      listing_id: listing.id,
      conversation_id: conversationId,
      quote_number: (qnum as unknown as string) ?? null,
      guest_name: d.guest_name,
      guest_email: emailLc,
      guest_phone: d.guest_phone || null,
      check_in: d.check_in,
      check_out: d.check_out,
      headcount,
      scope: d.scope,
      base_amount: baseAmount,
      cleaning_fee: cleaningFee,
      addons_total: 0,
      total_amount: total,
      discount_type: null,
      discount_value: 0,
      discount_amount: 0,
      deposit_type: "full",
      deposit_pct: 50,
      deposit_amount: total,
      balance_amount: 0,
      balance_due_days: 7,
      currency,
      notes: null,
      status: "draft",
      guests_breakdown: d.guests_breakdown,
      policy_snapshot: {
        cancellation_policy: listing.cancellation_policy ?? null,
        cancellation_policy_label: listing.cancellation_policy_label ?? null,
        captured_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();
  if (qErr || !quote) {
    return { ok: false, error: "Could not create the draft quote." };
  }

  if (d.scope === "rooms" && priced.ok && priced.data.rooms.length > 0) {
    await admin.from("quote_rooms").insert(
      priced.data.rooms.map((r) => ({
        quote_id: quote.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
  }

  // Thread messages: the guest's note, the draft-quote card, then a guest-facing
  // acknowledgement. Inserted sequentially so created_at orders them correctly.
  const noteBody = d.message || `Quote request for ${listing.name}.`;
  await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: guestId,
    body: noteBody,
    read_by_host: false,
  });
  await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: null,
    is_system_message: true,
    system_event: "quote_draft",
    quote_id: quote.id,
    body: `Quote request for ${listing.name} · ${d.check_in} → ${d.check_out}`,
    read_by_host: false,
    // The guest's own action generated this card — don't flag it unread for them.
    read_by_guest: true,
  });

  // Away auto-reply — if the host set one and the enquiry arrives during their
  // notification quiet hours, post it into the thread so the guest knows.
  const autoReply = hostRow.enquiry_auto_reply?.trim();
  if (autoReply) {
    const { data: qh } = await admin
      .from("user_notification_settings")
      .select(
        "quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone",
      )
      .eq("user_id", hostRow.user_id)
      .maybeSingle();
    if (isWithinQuietHours(qh)) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: null,
        is_system_message: true,
        system_event: "auto_reply",
        body: autoReply,
        read_by_guest: false,
      });
    }
  }

  // Notify the host via the dedicated quote-request event so it lands in the
  // "Quote requests" bell tab (not "Messages"). Best-effort and dynamically
  // imported so a dispatcher load/runtime error can't fail the enquiry, which
  // has already been written at this point.
  try {
    const { dispatchEvent } = await import("@/lib/notifications/dispatch");
    await dispatchEvent({
      kind: "quote_request_host",
      recipientUserId: hostRow.user_id,
      hostId: listing.host_id,
      refs: {
        conversation_id: conversationId,
        guest_first_name: d.guest_name.split(" ")[0] || d.guest_name,
        listing_name: listing.name,
      },
    });
  } catch {
    // Notification is best-effort — the enquiry already succeeded.
  }

  // Decide where the guest goes after submitting, and (for a new/unclaimed
  // lead) mint a single magic-link token reused by BOTH the in-app redirect and
  // the email link — generating two would invalidate the first.
  //   • lead  → /auth/confirm signs them in, then the claim screen (set a
  //             password) which finally lands them on this thread.
  //   • account → /login, returning to this thread.
  const claimNext = encodeURIComponent(`/claim?c=${conversationId}`);
  const inboxNext = encodeURIComponent(`/portal/inbox/${conversationId}`);
  let redirectTo = `/login?next=${inboxNext}`;
  let claimTokenHash: string | null = null;
  if (isLead) {
    try {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: emailLc,
      });
      claimTokenHash = linkData?.properties?.hashed_token ?? null;
    } catch {
      claimTokenHash = null;
    }
    if (claimTokenHash) {
      redirectTo = `/auth/confirm?token_hash=${claimTokenHash}&type=magiclink&next=${claimNext}`;
    } else {
      // Couldn't mint a link — fall back to the thread (login will gate it).
      redirectTo = `/portal/inbox/${conversationId}`;
    }
  }

  // Acknowledge to the guest by email (best-effort, never blocks the enquiry).
  try {
    const esc = (s: string) =>
      s.replace(
        /[<>&]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
      );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    let actionHtml = "";
    if (isLead && appUrl && claimTokenHash) {
      const claimUrl = `${appUrl}/auth/confirm?token_hash=${claimTokenHash}&type=magiclink&next=${claimNext}`;
      actionHtml = `<p><a href="${claimUrl}" style="color:#0d9488;font-weight:600">Set a password &amp; track your request &rarr;</a></p>`;
    } else if (appUrl) {
      actionHtml = `<p><a href="${appUrl}/portal/inbox/${conversationId}" style="color:#0d9488;font-weight:600">View your request in your inbox &rarr;</a></p>`;
    }
    const { getBrandName } = await import("@/lib/brand");
    const brand = await getBrandName();
    const { sendTransactionalEmail } = await import("@/lib/email/send");
    await sendTransactionalEmail({
      to: emailLc,
      subject: `We've sent your request to ${hostRow.display_name}`,
      html: `<p>Hi ${esc(d.guest_name.split(" ")[0])},</p><p>Thanks for your interest in <strong>${esc(listing.name)}</strong>. Your request (${d.check_in} &rarr; ${d.check_out}) has reached ${esc(hostRow.display_name)}, who'll reply with a tailored quote.</p>${actionHtml}<p style="color:#6b7280;font-size:12px">Sent via ${esc(brand)}</p>`,
    });
  } catch {
    // Email is best-effort — the enquiry already succeeded.
  }

  return {
    ok: true,
    data: { isLead, email: emailLc, conversationId, redirectTo },
  };
}
