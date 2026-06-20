import type { SupabaseClient } from "@supabase/supabase-js";

// Canonical "guest record" writer — the ONE find-or-update-by-email path for
// host_contacts. Every place that would create a contact (manual add, lazy
// mint, enquiry lead) routes through here so a guest is NEVER duplicated on the
// same email and so guest_id is always back-filled when an account exists.
//
// Rule (matches the SQL _materialize_booking_party upsert + the Guests
// directory email-merge):
//   1. Look up the host's contact by lower(email).
//   2. Exists → UPDATE in place, keep the original email, back-fill guest_id.
//   3. None → INSERT a fresh row.
//   4. Either way the caller still links the guest to the booking/relationship
//      as normal — this only owns the contact row.
//
// Field-write semantics depend on `mode`:
//   • "fill" (default) — implicit mints (enquiry lead, lazy mint): only set
//     BLANK fields, never clobber data the host curated.
//   • "overwrite" — an explicit host edit (the Add/Edit guest form): set every
//     field the caller provided (a provided null clears it). guest_id is only
//     ever back-filled, never nulled; email is never changed.
//
// The host_contacts (host_id, lower(email)) unique index is the hard guarantee;
// this helper is the soft, app-wide one so we also reconcile guest_id + fields.

export type UpsertHostContactInput = {
  hostId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  /** Registered account id, if known. Resolved from the email when omitted. */
  guestId?: string | null;
  country?: string | null;
  notes?: string | null;
  lastStage?: string | null;
  /** POPIA: may only ever be turned ON (write-once); never used to revoke. */
  emailConsent?: boolean;
  /** Tags to ADD (merge-only, deduped) — never removes existing tags. */
  addTags?: string[];
  mode?: "fill" | "overwrite";
};

export type UpsertedContact = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  tags: string[];
  blocked: boolean;
  guest_id: string | null;
};

const COLS = "id, email, name, phone, tags, blocked, guest_id";

/**
 * Find-or-update a host's contact by email. Returns the canonical row, or null
 * if the email is blank or the write failed. Accepts any Supabase client (the
 * caller chooses admin vs user-bound so RLS is honoured where it applies).
 */
export async function upsertHostContact(
  supabase: SupabaseClient,
  input: UpsertHostContactInput,
): Promise<UpsertedContact | null> {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;
  const overwrite = input.mode === "overwrite";

  // Always know the account behind this email so guest_id is back-filled even
  // when the caller didn't pass it (e.g. manual "Add guest" for someone who
  // already has an account → folds into their u_ identity, no duplicate card).
  let guestId = input.guestId ?? null;
  if (!guestId) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    guestId = profile?.id ?? null;
  }

  const { data: existing } = await supabase
    .from("host_contacts")
    .select(COLS)
    .eq("host_id", input.hostId)
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    // Set a field when: explicit edit and it was provided (null clears it), OR
    // a fill-mint with a real value into a currently-blank column.
    const set = (
      key: string,
      value: string | null | undefined,
      current: string | null,
    ) => {
      if (value === undefined) return; // not provided → leave alone
      if (overwrite) patch[key] = value ?? null;
      else if (value && !current) patch[key] = value;
    };
    set("name", input.name, existing.name);
    set("phone", input.phone, existing.phone);
    set("country", input.country, null);
    set("notes", input.notes, null);
    if (input.lastStage) patch.last_stage = input.lastStage;
    if (guestId && !existing.guest_id) patch.guest_id = guestId;
    if (input.emailConsent) patch.email_consent = true;
    if (input.addTags && input.addTags.length > 0) {
      const current = existing.tags ?? [];
      const merged = Array.from(new Set([...current, ...input.addTags]));
      if (merged.length !== current.length) patch.tags = merged;
    }

    if (Object.keys(patch).length === 0) return existing as UpsertedContact;

    const { data: updated } = await supabase
      .from("host_contacts")
      .update(patch)
      .eq("id", existing.id)
      .select(COLS)
      .maybeSingle();
    return (updated as UpsertedContact) ?? (existing as UpsertedContact);
  }

  const { data: inserted } = await supabase
    .from("host_contacts")
    .insert({
      host_id: input.hostId,
      guest_id: guestId,
      email,
      name: input.name ?? null,
      phone: input.phone ?? null,
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.lastStage ? { last_stage: input.lastStage } : {}),
      ...(input.emailConsent ? { email_consent: true } : {}),
      ...(input.addTags && input.addTags.length > 0
        ? { tags: input.addTags }
        : {}),
    })
    .select(COLS)
    .maybeSingle();
  return (inserted as UpsertedContact) ?? null;
}
