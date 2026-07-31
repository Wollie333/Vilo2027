import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS. **Server-side only.**
 *
 * Per AGENT_RULES.md §1.1, the service role key must NEVER be exposed to the
 * client — no `NEXT_PUBLIC_` prefix, no use in components or hooks. Only call
 * this from Server Actions, Route Handlers, or Edge Functions.
 *
 * Use it sparingly: prefer the user-bound `createServerClient()` so RLS
 * enforces ownership. Reach for this only when RLS can't model the operation
 * (e.g. guest-initiated booking inserts where the guest isn't the host).
 *
 * `noStore: true` forces every request to `cache: "no-store"`. Next.js caches
 * GET fetches (PostgREST selects are GETs) into the Data Cache, so a route that
 * must read the LIVE row — e.g. the /r referral link deciding a campaign's
 * eligibility from its current status/dates — can otherwise serve a stale copy
 * until the cache revalidates. Pass this in dynamic route handlers where a
 * cached read would be a correctness bug.
 */
export function createAdminClient(opts?: { noStore?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(opts?.noStore
      ? {
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) =>
              fetch(input, { ...init, cache: "no-store" }),
          },
        }
      : {}),
  });
}
