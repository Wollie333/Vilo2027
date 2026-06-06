// Canonical guest key (gkey) — the one key used in routes, the directory RPC,
// and host_contacts resolution. MUST stay byte-for-byte compatible with the SQL
// guest_gkey_for_email() helper (see 20260606000002_guest_crm_list_rpcs.sql):
//   registered → u_<user_profiles.id>
//   email-based → e_<base64url(lower(trim(email)))>
//
// Server-only (uses Buffer). All callers (Server Actions, server pages) run in
// the Node runtime.

export function gkeyForEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return "e_" + Buffer.from(normalized, "utf8").toString("base64url");
}

export function gkeyForGuest(guestId: string): string {
  return "u_" + guestId;
}

/** Compute the gkey for a booking/contact: prefer the registered id, else email. */
export function gkeyFor(
  guestId: string | null | undefined,
  email: string | null | undefined,
): string | null {
  if (guestId) return gkeyForGuest(guestId);
  if (email && email.trim()) return gkeyForEmail(email);
  return null;
}

/** Decode an e_ gkey back to its lowercased email. Returns null for u_ keys. */
export function emailFromGkey(gkey: string): string | null {
  if (!gkey.startsWith("e_")) return null;
  try {
    return Buffer.from(gkey.slice(2), "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** Extract the user id from a u_ gkey. Returns null for e_ keys. */
export function guestIdFromGkey(gkey: string): string | null {
  return gkey.startsWith("u_") ? gkey.slice(2) : null;
}
