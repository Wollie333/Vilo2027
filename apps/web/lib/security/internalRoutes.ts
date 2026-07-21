import "server-only";

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Gate for internal-only routes (/dev/*, /style-lab, /builder-preview).
 *
 * These are build harnesses: unfinished flows, style galleries and raw preview
 * renderers. They were reachable by anyone in production — eight pages served
 * 200 to an anonymous visitor — which leaks in-progress UI, invites indexing of
 * pages that are not real product, and exercises code paths never meant for the
 * public.
 *
 * 404 rather than redirect or 403 on purpose: an internal tool should not
 * confirm it exists to someone who has no business seeing it.
 *
 * Applied via a layout in each directory rather than page by page, so every
 * future page added underneath is covered without anyone remembering to.
 */
export async function assertInternalRoute(): Promise<void> {
  // Local development is the point of these pages — never gate there.
  if (process.env.NODE_ENV !== "production") return;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Platform staff only. Being signed in is not enough — a guest account must
  // not reach a build harness.
  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("platform_staff")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff) notFound();
}
