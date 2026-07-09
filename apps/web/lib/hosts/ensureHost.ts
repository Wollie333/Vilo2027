import "server-only";

import { slugify, uniqueSlug } from "@/lib/help/slug";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// Resolve a user's host id, PROVISIONING one if they don't have it yet — turns a
// guest into a host. Used when an admin sells a guest a subscription/product
// from the admin user record (guest-first → convert). Mirrors the host set-up in
// fulfilFreeProductBySlug: create the host, flip the profile to a (non-lead)
// host, and seed the default policies. Idempotent — returns the existing host.
export async function ensureHostForUser(
  admin: Admin,
  userId: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("hosts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: prof } = await admin
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const name =
    prof?.full_name?.trim() || prof?.email?.split("@")[0]?.trim() || "Host";

  const base = slugify(name) || "host";
  const { data: taken } = await admin
    .from("hosts")
    .select("handle")
    .ilike("handle", `${base}%`);
  const handles = new Set(
    (taken ?? []).map((h) => (h as { handle: string }).handle),
  );

  const { data: created, error } = await admin
    .from("hosts")
    .insert({
      user_id: userId,
      handle: uniqueSlug(base, handles),
      display_name: name,
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Could not set up the host account.");
  }

  await admin
    .from("user_profiles")
    .update({ role: "host", is_lead: false })
    .eq("id", userId);

  try {
    await admin.rpc("ensure_host_default_policies", { p_host_id: created.id });
  } catch {
    // Best-effort — a missing policy preset must not block the sale.
  }

  return created.id as string;
}
