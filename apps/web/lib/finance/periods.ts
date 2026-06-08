import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type PeriodCheck = { ok: true } | { ok: false; error: string };

/**
 * Guard a money mutation against a closed accounting period. Pass the date the
 * transaction is (or would be) dated; if that host-month is closed, the mutation
 * is refused — post a reversing entry in the open period instead. The ONE place
 * the period lock is enforced.
 */
export async function assertPeriodOpen(
  admin: Admin,
  hostId: string,
  dateISO: string,
): Promise<PeriodCheck> {
  const d = (dateISO ?? "").slice(0, 10);
  if (!d) return { ok: true };
  const { data } = await admin.rpc("is_period_closed", {
    p_host_id: hostId,
    p_date: d,
  });
  if (data === true) {
    return {
      ok: false,
      error: `The ${d.slice(0, 7)} accounting period is closed. Post a reversing entry in the current period instead.`,
    };
  }
  return { ok: true };
}
