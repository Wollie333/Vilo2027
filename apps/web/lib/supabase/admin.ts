import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@vilo/types";

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
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
