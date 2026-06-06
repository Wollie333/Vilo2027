"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  emailFromGkey,
  gkeyForEmail,
  guestIdFromGkey,
} from "@/lib/guests/gkey";
import { createServerClient } from "@/lib/supabase/server";

import type { GuestRow } from "./GuestsBoard";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function getHost(): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
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
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };
  return { ok: true, hostId: host.id, userId: user.id };
}

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

  const { data: existing } = await supabase
    .from("host_contacts")
    .select("id, email, name, phone, tags, blocked")
    .eq("host_id", hostId)
    .ilike("email", email)
    .maybeSingle();
  if (existing) return existing as ContactRow;

  const { data: inserted } = await supabase
    .from("host_contacts")
    .insert({
      host_id: hostId,
      guest_id: guestId,
      email,
      name,
      phone,
    })
    .select("id, email, name, phone, tags, blocked")
    .single();
  return (inserted as ContactRow) ?? null;
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
  const gkey = gkeyForEmail(email);
  const supabase = createServerClient();

  // Upsert by (host, email): updating an existing contact rather than erroring.
  const { data: existing } = await supabase
    .from("host_contacts")
    .select("id")
    .eq("host_id", host.hostId)
    .ilike("email", email)
    .maybeSingle();

  const payload = {
    name: v.name,
    phone: v.phone || null,
    country: v.country || null,
    notes: v.notes || null,
    email_consent: v.email_consent ?? false,
  };

  if (existing) {
    const { error } = await supabase
      .from("host_contacts")
      .update(payload)
      .eq("id", existing.id);
    if (error) return { ok: false, error: "Could not save the guest." };
  } else {
    const { error } = await supabase
      .from("host_contacts")
      .insert({ host_id: host.hostId, email, ...payload });
    if (error) return { ok: false, error: "Could not add the guest." };
  }

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
