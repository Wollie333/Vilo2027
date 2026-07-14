"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

interface UpdateQuotaInput {
  plan_id: string;
  guest_posts_per_day: number | null;
  guest_posts_per_month: number | null;
  host_quotes_per_day: number | null;
  host_quotes_per_month: number | null;
}

export async function updateQuotaAction(input: UpdateQuotaInput) {
  await requirePermission("platform.features");

  const service = createAdminClient();

  // Only the four fields the form edits are written. The yearly caps (and the
  // extension / expiry / display-cap columns) are intentionally omitted so an
  // upsert-update leaves them untouched — the old code hard-wrote
  // *_per_year: null, silently wiping the seeded annual limits on every save.
  const { error } = await service.from("looking_for_quotas").upsert(
    {
      plan_id: input.plan_id,
      guest_posts_per_day: input.guest_posts_per_day,
      guest_posts_per_month: input.guest_posts_per_month,
      host_quotes_per_day: input.host_quotes_per_day,
      host_quotes_per_month: input.host_quotes_per_month,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id" },
  );

  if (error) {
    console.error("Failed to update quota:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/looking-for/quotas");
  return { success: true };
}
