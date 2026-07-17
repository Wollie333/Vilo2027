import "server-only";

import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mint a Wielo guest account for every additional / party guest on a booking.
 *
 * BUSINESS_PRINCIPLES #1 rule 1 names this entry point explicitly — "being added
 * as an additional / party guest on someone else's booking" mints (or reuses) a
 * single global Wielo guest account, for free. Until now the party guests were
 * only ever written to `bookings.additional_guests` as JSONB and existed nowhere
 * else, so the guest graph silently missed everyone who travelled on someone
 * else's booking.
 *
 * Goes through {@link findOrCreateLeadIdentity} — the ONE find-or-create path —
 * so an email that already has an account is reused, never duplicated, and a
 * brand-new one is minted passwordless (`is_lead = true`) and claimed later
 * (rule 3). Email is the identity key, so a party guest without one is skipped:
 * there is nothing to key an account on.
 *
 * Called from the single persistence tail so every booking path mints uniformly.
 * Best-effort: a booking must NEVER fail because identity minting did.
 */
export async function mintPartyGuestIdentities(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<void> {
  try {
    const { data: bk } = await admin
      .from("bookings")
      .select("additional_guests, guest_id")
      .eq("id", bookingId)
      .maybeSingle();
    const row = bk as {
      additional_guests: unknown;
      guest_id: string | null;
    } | null;
    if (!row || !Array.isArray(row.additional_guests)) return;

    const party = row.additional_guests as Array<{
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    }>;

    const seen = new Set<string>();
    for (const g of party) {
      const email = (g?.email ?? "").trim().toLowerCase();
      const name = (g?.name ?? "").trim();
      // Email is the universal identity key (rule 2) — no email, no account.
      if (!email || !name) continue;
      // Same email twice on one booking is one guest.
      if (seen.has(email)) continue;
      seen.add(email);

      await findOrCreateLeadIdentity(admin, {
        email,
        name,
        phone: g?.phone?.trim() || null,
      });
    }
  } catch {
    // non-blocking — never fail the booking on identity minting
  }
}
