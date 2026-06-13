"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hostCanRateGuest } from "@/lib/guests/can-rate";
import { upsertHostContact } from "@/lib/guests/contacts";
import {
  emailFromGkey,
  gkeyForEmail,
  gkeyForGuest,
  guestIdFromGkey,
} from "@/lib/guests/gkey";
import { requireHost as getHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import { guestRatingSchema, type GuestRatingInput } from "./_rating/schemas";
import type { GuestRow } from "./GuestsBoard";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type ContactRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  tags: string[];
  blocked: boolean;
};

// Resolve a gkey to its host_contacts row, minting one lazily if the guest
// exists in the directory (bookings) but has no contact row yet. Returns null
// when the gkey can't be resolved to an email (no contact can be created).
async function ensureContact(
  hostId: string,
  gkey: string,
): Promise<ContactRow | null> {
  const supabase = createServerClient();
  const guestId = guestIdFromGkey(gkey);

  let email: string | null = null;
  let name: string | null = null;
  let phone: string | null = null;

  if (guestId) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("email, full_name, phone")
      .eq("id", guestId)
      .maybeSingle();
    email = profile?.email ?? null;
    name = profile?.full_name ?? null;
    phone = profile?.phone ?? null;
  } else {
    email = emailFromGkey(gkey);
    if (email) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("guest_name, guest_phone")
        .eq("host_id", hostId)
        .ilike("guest_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      name = booking?.guest_name ?? null;
      phone = booking?.guest_phone ?? null;
    }
  }

  if (!email) return null;

  // Lazy mint → fill-only (never clobber host-curated fields), deduped by email,
  // guest_id back-filled. The one canonical contact writer.
  const contact = await upsertHostContact(supabase, {
    hostId,
    email,
    name,
    phone,
    guestId,
  });
  return (contact as ContactRow) ?? null;
}

// ── Marketing opt-out (POPIA: host may only ever turn it OFF) ───────────
// Opting a guest IN only happens via the consent tick at Add-guest (write-once)
// or the guest's own (un)subscribe link — never a free host toggle. This action
// is the single host-side write: honouring an opt-out request.
async function emailForGkey(
  hostId: string,
  gkey: string,
): Promise<string | null> {
  const guestId = guestIdFromGkey(gkey);
  if (guestId) {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("id", guestId)
      .maybeSingle();
    return data?.email ?? null;
  }
  return emailFromGkey(gkey);
}

export async function recordOptOutAction(gkey: string): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const email = await emailForGkey(host.hostId, gkey);
  if (!email) return { ok: false, error: "This guest has no email on file." };

  const supabase = createServerClient();
  const { error } = await supabase.from("guest_marketing").upsert(
    {
      host_id: host.hostId,
      gkey,
      email: email.toLowerCase(),
      is_subscribed: false,
      unsubscribed_at: new Date().toISOString(),
      source: "manual",
    },
    { onConflict: "host_id,gkey" },
  );
  if (error) return { ok: false, error: "Could not record the opt-out." };

  revalidatePath(`/dashboard/guests/${gkey}`);
  revalidatePath("/dashboard/guests");
  return { ok: true };
}

// ── Notes (guest_notes — keyed by gkey, host-only timeline) ─────────────
export async function addGuestNoteAction(
  gkey: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  const text = body.trim();
  if (!text) return { ok: false, error: "Note can't be empty." };
  if (text.length > 2000) return { ok: false, error: "Note is too long." };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("guest_notes")
    .insert({
      host_id: host.hostId,
      gkey,
      author_id: host.userId,
      body: text,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not save the note." };

  revalidatePath(`/dashboard/guests/${gkey}`);
  return { ok: true, data: { id: data.id } };
}

export async function deleteGuestNoteAction(
  gkey: string,
  noteId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("guest_notes")
    .delete()
    .eq("id", noteId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not delete the note." };

  revalidatePath(`/dashboard/guests/${gkey}`);
  return { ok: true };
}

export async function pinGuestNoteAction(
  gkey: string,
  noteId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  // Only one pinned note per guest — clear the others when pinning.
  if (pinned) {
    await supabase
      .from("guest_notes")
      .update({ is_pinned: false })
      .eq("host_id", host.hostId)
      .eq("gkey", gkey);
  }
  const { error } = await supabase
    .from("guest_notes")
    .update({ is_pinned: pinned })
    .eq("id", noteId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not update the note." };

  revalidatePath(`/dashboard/guests/${gkey}`);
  return { ok: true };
}

// ── Add guest (manual contact) ──────────────────────────────────────────
const addGuestSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  email_consent: z.boolean().optional(),
});
export type AddGuestInput = z.infer<typeof addGuestSchema>;

export async function addGuestContactAction(
  input: AddGuestInput,
): Promise<ActionResult<{ gkey: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const parsed = addGuestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const v = parsed.data;
  const email = v.email.toLowerCase();
  const supabase = createServerClient();

  // Explicit host edit → find-or-update by email through the one canonical
  // writer (dedupes on email, back-fills guest_id so the contact folds into the
  // guest's account identity instead of spawning a duplicate directory card).
  const contact = await upsertHostContact(supabase, {
    hostId: host.hostId,
    email,
    name: v.name,
    phone: v.phone || null,
    country: v.country || null,
    notes: v.notes || null,
    // Write-once to TRUE — ticking grants consent; never revoked by a later edit.
    emailConsent: v.email_consent || undefined,
    mode: "overwrite",
  });
  if (!contact) return { ok: false, error: "Could not save the guest." };

  // Canonical gkey: u_<id> once linked to an account, else e_<email>.
  const gkey = contact.guest_id
    ? gkeyForGuest(contact.guest_id)
    : gkeyForEmail(email);

  revalidatePath("/dashboard/guests");
  return { ok: true, data: { gkey } };
}

// ── Tags (host_contacts.tags text[]) ────────────────────────────────────
export async function addGuestTagAction(
  gkey: string,
  label: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const tag = label.trim();
  if (!tag) return { ok: false, error: "Tag can't be empty." };
  if (tag.length > 40) return { ok: false, error: "Tag is too long." };

  const contact = await ensureContact(host.hostId, gkey);
  if (!contact) return { ok: false, error: "Couldn't find that guest." };
  if (contact.tags.includes(tag)) {
    revalidatePath(`/dashboard/guests/${gkey}`);
    return { ok: true };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_contacts")
    .update({ tags: [...contact.tags, tag] })
    .eq("id", contact.id);
  if (error) return { ok: false, error: "Could not add the tag." };

  revalidatePath("/dashboard/guests");
  revalidatePath(`/dashboard/guests/${gkey}`);
  return { ok: true };
}

export async function removeGuestTagAction(
  gkey: string,
  label: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const contact = await ensureContact(host.hostId, gkey);
  if (!contact) return { ok: false, error: "Couldn't find that guest." };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_contacts")
    .update({ tags: contact.tags.filter((t) => t !== label) })
    .eq("id", contact.id);
  if (error) return { ok: false, error: "Could not remove the tag." };

  revalidatePath("/dashboard/guests");
  revalidatePath(`/dashboard/guests/${gkey}`);
  return { ok: true };
}

export async function bulkTagAction(
  gkeys: string[],
  label: string,
): Promise<ActionResult<{ tagged: number }>> {
  const host = await getHost();
  if (!host.ok) return host;
  const tag = label.trim();
  if (!tag) return { ok: false, error: "Tag can't be empty." };
  if (gkeys.length === 0) return { ok: false, error: "No guests selected." };

  const supabase = createServerClient();
  let tagged = 0;
  for (const gkey of gkeys.slice(0, 500)) {
    const contact = await ensureContact(host.hostId, gkey);
    if (!contact || contact.tags.includes(tag)) continue;
    const { error } = await supabase
      .from("host_contacts")
      .update({ tags: [...contact.tags, tag] })
      .eq("id", contact.id);
    if (!error) tagged++;
  }

  revalidatePath("/dashboard/guests");
  return { ok: true, data: { tagged } };
}

// ── Block / unblock (display-only v1, decision 2) ───────────────────────
export async function blockGuestAction(
  gkey: string,
  reason?: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const contact = await ensureContact(host.hostId, gkey);
  if (!contact) return { ok: false, error: "Couldn't find that guest." };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_contacts")
    .update({
      blocked: true,
      blocked_at: new Date().toISOString(),
      blocked_reason: reason?.trim() || null,
    })
    .eq("id", contact.id);
  if (error) return { ok: false, error: "Could not block the guest." };

  revalidatePath("/dashboard/guests");
  revalidatePath(`/dashboard/guests/${gkey}`);
  return { ok: true };
}

export async function unblockGuestAction(gkey: string): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const contact = await ensureContact(host.hostId, gkey);
  if (!contact) return { ok: false, error: "Couldn't find that guest." };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_contacts")
    .update({ blocked: false, blocked_at: null, blocked_reason: null })
    .eq("id", contact.id);
  if (error) return { ok: false, error: "Could not unblock the guest." };

  revalidatePath("/dashboard/guests");
  revalidatePath(`/dashboard/guests/${gkey}`);
  return { ok: true };
}

// ── Export (CSV) — honours the active filters or a selection ────────────
const csvEsc = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export type ExportFilters = {
  seg?: string;
  q?: string;
  listingId?: string;
  channel?: string;
  minRating?: number;
  gkeys?: string[];
};

export async function exportGuestsAction(
  filters: ExportFilters,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data } = await supabase.rpc("fetch_host_guests", {
    p_host_id: host.hostId,
    p_segment: filters.seg ?? "all",
    p_search: filters.q || null,
    p_listing_id: filters.listingId || null,
    p_channel: filters.channel || null,
    p_min_rating: filters.minRating ?? null,
    p_sort: "name",
    p_limit: 5000,
    p_offset: 0,
  });

  let rows = ((data as { guests?: GuestRow[] } | null)?.guests ??
    []) as GuestRow[];
  if (filters.gkeys && filters.gkeys.length > 0) {
    const set = new Set(filters.gkeys);
    rows = rows.filter((r) => set.has(r.gkey));
  }

  const header = [
    "Name",
    "Email",
    "Phone",
    "Country",
    "Segment",
    "Stays",
    "Nights",
    "Lifetime value",
    "Currency",
    "Avg rating",
    "First stay",
    "Last stay",
    "Tags",
  ];
  const segOf = (r: GuestRow) =>
    r.is_vip
      ? "VIP"
      : r.is_returning
        ? "Returning"
        : r.is_ota
          ? "Via OTA"
          : "New";
  const lines = rows.map((r) =>
    [
      csvEsc(r.name),
      csvEsc(r.email),
      csvEsc(r.phone),
      csvEsc(r.country),
      csvEsc(segOf(r)),
      csvEsc(r.total_stays),
      csvEsc(r.total_nights),
      csvEsc(r.lifetime_value),
      csvEsc(r.currency),
      csvEsc(r.avg_rating ?? ""),
      csvEsc(r.first_stay ?? ""),
      csvEsc(r.last_stay ?? ""),
      csvEsc((r.tags ?? []).join("; ")),
    ].join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  return { ok: true, data: { csv, filename: "vilo-guests.csv" } };
}

// ── Bulk mailer — broadcast (POPIA-safe, monthly-capped, build-only) ────
const broadcastSchema = z.object({
  audience: z.string().trim().min(1).max(60),
  subject: z.string().trim().min(2, "Add a subject.").max(150),
  body: z.string().trim().min(2, "Write a message.").max(8000),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

export async function sendBroadcastAction(
  input: BroadcastInput,
): Promise<
  | { ok: true; sent: number; skipped: number }
  | { ok: false; error: string; nextAllowedOn?: string }
> {
  const host = await getHost();
  if (!host.ok) return { ok: false, error: host.error };

  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const v = parsed.data;

  const supabase = createServerClient();

  // Re-check the monthly cap server-side (never trust the client).
  const { data: gate } = await supabase.rpc("can_send_broadcast", {
    p_host_id: host.hostId,
  });
  const g = gate as {
    allowed?: boolean;
    next_allowed_on?: string;
  } | null;
  if (!g?.allowed) {
    return {
      ok: false,
      error: "You've already sent this month's broadcast.",
      nextAllowedOn: g?.next_allowed_on,
    };
  }

  // Sender identity: platform verified domain, display name = host brand,
  // reply-to = host's own email (decision D).
  const [{ data: hostRow }, { data: me }] = await Promise.all([
    supabase
      .from("hosts")
      .select("display_name")
      .eq("id", host.hostId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("email")
      .eq("id", host.userId)
      .maybeSingle(),
  ]);

  const { sendGuestBroadcast } = await import("@/lib/guests/broadcast");
  const res = await sendGuestBroadcast({
    hostId: host.hostId,
    userId: host.userId,
    hostBrandName: hostRow?.display_name ?? null,
    replyTo: me?.email ?? null,
    audience: v.audience,
    subject: v.subject,
    body: v.body,
  });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/dashboard/guests");
  return { ok: true, sent: res.sent, skipped: res.skipped };
}

export type BroadcastPreview = {
  eligible: number;
  no_email: number;
  unsubscribed: number;
  no_consent: number;
};

export async function broadcastPreviewAction(
  audience: string,
): Promise<ActionResult<BroadcastPreview>> {
  const host = await getHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("count_broadcast_recipients", {
    p_host_id: host.hostId,
    p_audience: audience,
  });
  if (error) return { ok: false, error: "Could not count recipients." };
  return { ok: true, data: data as BroadcastPreview };
}

export type BroadcastStatus = {
  canSend: boolean;
  nextAllowedOn: string | null;
  recent: {
    id: string;
    subject: string;
    audience: string;
    recipient_count: number;
    sent_at: string;
  }[];
};

export async function broadcastStatusAction(): Promise<
  ActionResult<BroadcastStatus>
> {
  const host = await getHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const [{ data: gate }, { data: recent }] = await Promise.all([
    supabase.rpc("can_send_broadcast", { p_host_id: host.hostId }),
    supabase
      .from("guest_broadcasts")
      .select("id, subject, audience, recipient_count, sent_at")
      .eq("host_id", host.hostId)
      .order("sent_at", { ascending: false })
      .limit(5),
  ]);
  const g = gate as { allowed?: boolean; next_allowed_on?: string } | null;
  return {
    ok: true,
    data: {
      canSend: g?.allowed ?? false,
      nextAllowedOn: g?.next_allowed_on ?? null,
      recent: (recent ?? []) as BroadcastStatus["recent"],
    },
  };
}

// ── Guest reputation (host → guest rating, cross-host) ──────────────────
// Internal, host-only. One living review per host per guest, keyed on the
// guest's Vilo account id. Eligibility (a completed/no-show stay) is enforced
// here AND in RLS (own-row write). No notifications — guests never see it.
export async function upsertGuestRatingAction(
  guestId: string,
  input: GuestRatingInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const parsed = guestRatingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const v = parsed.data;

  const supabase = createServerClient();
  // Eligibility gate — only rate guests you've actually hosted.
  const eligible = await hostCanRateGuest(supabase, host.hostId, guestId);
  if (!eligible) {
    return {
      ok: false,
      error: "You can rate this guest after a completed stay.",
    };
  }

  const { error } = await supabase.from("guest_ratings").upsert(
    {
      host_id: host.hostId,
      guest_id: guestId,
      rating: v.rating,
      summary: v.summary?.trim() || null,
      rating_payments: v.rating_payments ?? null,
      rating_communication: v.rating_communication ?? null,
      rating_cleanliness: v.rating_cleanliness ?? null,
      rating_house_rules: v.rating_house_rules ?? null,
      rating_integrity: v.rating_integrity ?? null,
      note_payments: v.note_payments?.trim() || null,
      note_communication: v.note_communication?.trim() || null,
      note_cleanliness: v.note_cleanliness?.trim() || null,
      note_house_rules: v.note_house_rules?.trim() || null,
      note_integrity: v.note_integrity?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "host_id,guest_id" },
  );
  if (error) return { ok: false, error: "Could not save your rating." };

  revalidatePath(`/dashboard/guests/${gkeyForGuest(guestId)}`);
  return { ok: true };
}

export async function deleteGuestRatingAction(
  guestId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("guest_ratings")
    .delete()
    .eq("host_id", host.hostId)
    .eq("guest_id", guestId);
  if (error) return { ok: false, error: "Could not remove your rating." };

  revalidatePath(`/dashboard/guests/${gkeyForGuest(guestId)}`);
  return { ok: true };
}

// ── Per-guest vCard ("your list, yours to keep" — Pillar 3) ─────────────
export async function exportGuestVcardAction(
  gkey: string,
): Promise<ActionResult<{ vcard: string; filename: string }>> {
  const host = await getHost();
  if (!host.ok) return host;

  const supabase = createServerClient();
  const { data } = await supabase.rpc("fetch_guest_record", {
    p_host_id: host.hostId,
    p_gkey: gkey,
  });
  const rec = data as {
    name?: string;
    email?: string;
    phone?: string;
    error?: string;
  } | null;
  if (!rec || rec.error)
    return { ok: false, error: "Couldn't find that guest." };

  const name = rec.name ?? "Guest";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    rec.email ? `EMAIL:${rec.email}` : null,
    rec.phone ? `TEL:${rec.phone}` : null,
    "END:VCARD",
  ].filter(Boolean);
  const safe = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return {
    ok: true,
    data: { vcard: lines.join("\r\n"), filename: `${safe}.vcf` },
  };
}
