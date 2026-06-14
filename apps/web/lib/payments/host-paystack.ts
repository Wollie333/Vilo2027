import "server-only";

import { decryptSecret } from "@/lib/crypto/payments";
import { createAdminClient } from "@/lib/supabase/admin";

export type HostPaystack = {
  secretKey: string;
  statementDescriptor: string | null;
};

/**
 * The single source of truth for "this host can take card payments" — their
 * own connected Paystack account (an enabled `host_payment_gateways` row).
 *
 * Direct-host model: a guest's card payment settles to the HOST's Paystack
 * account (Vilo takes 0%), so the booking flow must initialise + verify the
 * transaction with the host's decrypted secret — never the platform
 * `PAYSTACK_SECRET_KEY`, which is reserved for Vilo's own subscription billing.
 * Because of this, host card payments are confirmed by the success-page
 * `verifyTransaction` (with the host key), not by the platform webhook.
 *
 * Returns null when the host hasn't connected Paystack, it's disabled, or the
 * stored secret can't be read — callers then fall back to manual EFT.
 *
 * Service-role client: callers include the guest checkout + the success page,
 * which can't RLS-read a host's gateway. The decrypted secret is used only to
 * call Paystack server-side and is NEVER returned to the client.
 */
function paystackFromRow(
  row: {
    secret_cipher: string | null;
    statement_descriptor: string | null;
    is_enabled: boolean | null;
  } | null,
): HostPaystack | null {
  if (!row || !row.is_enabled || !row.secret_cipher) return null;
  try {
    return {
      secretKey: decryptSecret(row.secret_cipher),
      statementDescriptor: row.statement_descriptor ?? null,
    };
  } catch {
    // A row that won't decrypt (e.g. PAYMENT_CIPHER_KEY rotated) is treated as
    // "no card rail" rather than crashing the checkout.
    return null;
  }
}

/**
 * The card rail for a specific BUSINESS — its own connected Paystack. Gateways
 * are per-business (one row per business+gateway), so a booking charges the
 * gateway of its listing's business. Resolve the business from
 * booking → listing → business_id and pass it here.
 */
export async function getHostPaystackForBusiness(
  businessId: string,
): Promise<HostPaystack | null> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("host_payment_gateways")
    .select("secret_cipher, statement_descriptor, is_enabled")
    .eq("business_id", businessId)
    .eq("gateway", "paystack")
    .maybeSingle();
  return paystackFromRow(row);
}

/**
 * The host's DEFAULT business gateway — for paths with no specific business
 * (e.g. the host's manual "request a payment" link). Booking payments should use
 * {@link getHostPaystackForBusiness} with the booking's business instead.
 */
export async function getHostPaystack(
  hostId: string,
): Promise<HostPaystack | null> {
  const supabase = createAdminClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("host_id", hostId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (!biz) return null;
  return getHostPaystackForBusiness(biz.id);
}
