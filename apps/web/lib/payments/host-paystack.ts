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
export async function getHostPaystack(
  hostId: string,
): Promise<HostPaystack | null> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("host_payment_gateways")
    .select("secret_cipher, statement_descriptor, is_enabled")
    .eq("host_id", hostId)
    .eq("gateway", "paystack")
    .maybeSingle();
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
