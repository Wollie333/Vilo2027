import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// The platform's current transaction environment, derived from the active Paystack
// mode (`platform_payment_settings.paystack_mode`). SINGLE source of truth for BOTH:
//   • tagging manual `platform_ledger` writes (so admin-recorded charges land in the
//     right scope instead of the column default 'live'), AND
//   • defaulting the env filter on every revenue window,
// so a producer and a consumer can never drift out of sync (that drift was the R50
// "collected here / nothing there" bug). Flips test → live automatically at launch.
// See docs/features/REPORTING_SINGLE_SOURCE_PLAN.md.

export type PlatformEnvironment = "live" | "test";

type Db = ReturnType<typeof createAdminClient>;

export async function resolvePlatformEnvironment(
  service: Db,
): Promise<PlatformEnvironment> {
  const { data } = await service
    .from("platform_payment_settings")
    .select("paystack_mode")
    .eq("id", true)
    .maybeSingle();
  return data?.paystack_mode === "test" ? "test" : "live";
}
