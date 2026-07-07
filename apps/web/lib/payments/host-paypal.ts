import "server-only";

import { decryptSecret } from "@/lib/crypto/payments";
import type { PayPalCreds } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The single source of truth for "this host can take PayPal payments" — their
 * own connected PayPal app (an enabled `host_payment_gateways` row where
 * gateway = 'paypal').
 *
 * Direct-host model, same as Paystack: a guest's PayPal payment settles to the
 * HOST's account (Wielo takes 0%), so orders are created + captured with the
 * host's own client id + decrypted secret — never a platform key. PayPal is the
 * "international" rail: it charges in USD (SA hosts can't hold a ZAR PayPal
 * balance), with the USD amount derived from the ZAR total via lib/fx.ts.
 *
 * Returns null when the host hasn't connected PayPal, it's disabled, or the
 * stored secret can't be read — callers then fall back to manual EFT. The
 * decrypted secret is only used server-side and is NEVER returned to the client.
 */
function paypalFromRow(
  row: {
    environment: string | null;
    public_identifier: string | null;
    secret_cipher: string | null;
    is_enabled: boolean | null;
  } | null,
): PayPalCreds | null {
  if (!row || !row.is_enabled) return null;
  if (!row.public_identifier || !row.secret_cipher) return null;
  try {
    return {
      clientId: row.public_identifier,
      secret: decryptSecret(row.secret_cipher),
      env: row.environment === "live" ? "live" : "test",
    };
  } catch {
    // A row that won't decrypt (e.g. PAYMENT_CIPHER_KEY rotated) is treated as
    // "no PayPal rail" rather than crashing the checkout.
    return null;
  }
}

/**
 * The PayPal rail for a specific BUSINESS — its own connected PayPal app.
 * Gateways are per-business (one row per business+gateway), so a booking uses
 * the gateway of its listing's business. Resolve the business from
 * booking → listing → business_id and pass it here.
 */
export async function getHostPayPalForBusiness(
  businessId: string,
): Promise<PayPalCreds | null> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("host_payment_gateways")
    .select("environment, public_identifier, secret_cipher, is_enabled")
    .eq("business_id", businessId)
    .eq("gateway", "paypal")
    .maybeSingle();
  return paypalFromRow(row);
}

/**
 * The host's DEFAULT business PayPal — for paths with no specific business.
 * Booking payments should use {@link getHostPayPalForBusiness} with the
 * booking's business instead.
 */
export async function getHostPayPal(
  hostId: string,
): Promise<PayPalCreds | null> {
  const supabase = createAdminClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("host_id", hostId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (!biz) return null;
  return getHostPayPalForBusiness(biz.id);
}
