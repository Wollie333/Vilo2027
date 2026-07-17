import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

export type PartyMember = {
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  /** They have a Wielo account, so name + photo came from their own profile. */
  isMember: boolean;
};

/**
 * THE one way to read a booking's party manifest for display.
 *
 * `bookings.additional_guests` stores what the booker typed at checkout. Every
 * party guest is also minted a Wielo account (BUSINESS_PRINCIPLES #1), so their
 * own profile is the better source: prefer its name + photo, and fall back to
 * the typed text for anyone without a profile (or without an email).
 *
 * Needs the admin client — a guest cannot RLS-read another guest's profile.
 * One batched query, not one per member.
 */
export async function resolvePartyGuests(
  admin: ReturnType<typeof createAdminClient>,
  additionalGuests: unknown,
): Promise<PartyMember[]> {
  const raw = (
    Array.isArray(additionalGuests)
      ? (additionalGuests as Array<{
          name?: string | null;
          email?: string | null;
          phone?: string | null;
        }>)
      : []
  )
    .filter((g) => (g?.name ?? "").trim().length > 0)
    .map((g) => ({
      name: (g.name ?? "").trim(),
      email: g.email?.trim() ? g.email.trim() : null,
      phone: g.phone?.trim() ? g.phone.trim() : null,
    }));
  if (raw.length === 0) return [];

  const emails = raw
    .map((g) => g.email?.toLowerCase())
    .filter((e): e is string => !!e);

  const profiles = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();
  if (emails.length > 0) {
    const { data: rows } = await admin
      .from("user_profiles")
      .select("email, full_name, avatar_url")
      .in("email", emails);
    for (const r of rows ?? []) {
      if (r.email) {
        profiles.set(r.email.toLowerCase(), {
          full_name: r.full_name,
          avatar_url: r.avatar_url,
        });
      }
    }
  }

  return raw.map((g) => {
    const p = g.email ? profiles.get(g.email.toLowerCase()) : undefined;
    return {
      name: p?.full_name?.trim() || g.name,
      email: g.email,
      phone: g.phone,
      avatarUrl: p?.avatar_url ?? null,
      isMember: !!p,
    };
  });
}
