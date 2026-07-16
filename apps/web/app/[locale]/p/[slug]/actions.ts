"use server";

import { headers } from "next/headers";

import { purchaseProductBySlug } from "@/lib/billing/product-checkout";
import { createServerClient } from "@/lib/supabase/server";

// Public self-serve purchase from a product's standalone page. Free products
// provision the buyer + return an auto-sign-in link; paid products return a
// pay-link. `free` lets the UI show the right progress copy.
//
// A LOGGED-IN buyer never types their email: we resolve it from the session and
// IGNORE any client-supplied value, so the purchase (and the credits/plan it
// grants) always lands on their own account — never a client-forged address.
// Anonymous buyers still supply an email (validated below).
export async function buyProductAction(
  slug: string,
  email: string,
): Promise<
  { ok: true; url: string; free: boolean } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const effectiveEmail = (user?.email ?? email ?? "").trim().toLowerCase();
  if (!effectiveEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(effectiveEmail)) {
    return { ok: false, error: "Enter a valid email." };
  }
  const origin = headers().get("origin") ?? "";
  const r = await purchaseProductBySlug(slug, effectiveEmail, origin);
  return r.ok
    ? { ok: true, url: r.url, free: r.free }
    : { ok: false, error: r.error };
}
