import type { SupabaseClient } from "@supabase/supabase-js";

import { bindAffiliateReferral } from "@/lib/affiliate/attribution";

// The ONE find-or-create path for the Wielo guest account behind a public
// enquiry email (BUSINESS_PRINCIPLES #1 — every entry mints a guest identity).
// Shared by BOTH public entry points that mint a lead: the listing quote enquiry
// (lib/enquiry/create-enquiry.ts) and the website contact-form enquiry
// (lib/website/createWebsiteEnquiry.ts) — so a guest is never duplicated on the
// same email and a brand-new account is always affiliate-attributed.
//
// A new account is a passwordless LEAD (is_lead=true): not signed in, claimable
// later by setting a password. Must run with the admin/service-role client (the
// visitor is anonymous). Returns null only if the auth user couldn't be created.

export async function findOrCreateLeadIdentity(
  admin: SupabaseClient,
  input: { email: string; name: string; phone?: string | null },
): Promise<{ guestId: string; isLead: boolean } | null> {
  const email = input.email.trim().toLowerCase();

  const { data: existing } = await admin
    .from("user_profiles")
    .select("id, is_lead")
    .ilike("email", email)
    .maybeSingle();
  if (existing) {
    return { guestId: existing.id, isLead: existing.is_lead ?? false };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: input.name },
  });
  if (error || !created.user) return null;

  const guestId = created.user.id;
  await admin
    .from("user_profiles")
    .update({
      full_name: input.name,
      phone: input.phone || null,
      role: "guest",
      is_lead: true,
    })
    .eq("id", guestId);
  // A newly-minted lead is a new Wielo account — attribute it to a referring
  // affiliate if a vilo_ref cookie is present on this request.
  await bindAffiliateReferral(guestId);

  return { guestId, isLead: true };
}
