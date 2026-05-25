import { BOOKING_RESOLVERS } from "./booking";
import { REFUND_RESOLVERS } from "./refund";
import { MISC_RESOLVERS } from "./misc";
import type { EmailResolver } from "./types";

export type { EmailResolver, ResolverContext } from "./types";

/**
 * Map of email type → resolver. The drain looks up by row.type, calls the
 * resolver with the row's payload as `refs` plus the shared context, then
 * merges the result with the original payload (payload wins).
 *
 * Types without a resolver fall through to the legacy behaviour: send
 * straight from payload. That keeps the admin /admin/emails preview tool
 * working without touching the DB.
 *
 * Templates not covered by a resolver yet (e.g. `staff_invite`): the
 * enqueueing code must continue to provide the full payload.
 */
export const RESOLVERS: Record<string, EmailResolver> = {
  ...BOOKING_RESOLVERS,
  ...REFUND_RESOLVERS,
  ...MISC_RESOLVERS,
};

export function hasResolver(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESOLVERS, type);
}
