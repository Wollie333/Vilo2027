import type { createAdminClient } from "@/lib/supabase/admin";

export type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolver context — what each resolver gets from the worker. The supabase
 * client uses the service-role key so resolvers can read across tenants
 * (they only run inside the email worker, never from a guest/host session).
 */
export type ResolverContext = {
  supabase: AdminClient;
};

/**
 * A resolver takes the small reference payload that was enqueued (e.g.
 * `{ booking_id: '…' }`) plus the context and returns the full prop bag
 * for the template. The drain merges this with the original payload —
 * payload wins on conflicts, so an explicit field in the queue row can
 * still override a resolver-computed default (and so the admin preview
 * tool keeps working with sample payloads).
 *
 * Resolvers must be tolerant of missing data: if the booking has been
 * hard-deleted, return whatever can still be computed and let the
 * template fall back to its defaults.
 */
export type EmailResolver = (
  refs: Record<string, unknown>,
  ctx: ResolverContext,
) => Promise<Record<string, unknown>>;

export function refId(
  refs: Record<string, unknown>,
  key: string,
): string | null {
  const v = refs[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
