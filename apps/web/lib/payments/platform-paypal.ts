import "server-only";

import { decryptSecret } from "@/lib/crypto/payments";
import type { PayPalCreds } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wielo's OWN PayPal app — the platform rail for PRODUCT/subscription orders paid
 * to Wielo (never a host's key; that's for booking money). Stored on the
 * singleton platform_payment_settings row (client id + encrypted secret +
 * environment + enabled), the platform sibling of host_payment_gateways.
 *
 * PayPal is the international rail: product orders are charged in USD (converted
 * from the ZAR amount via lib/fx.ts); the ledger stays in ZAR. Returns null when
 * PayPal isn't enabled/configured or the secret can't be decrypted — callers
 * then fall back to Paystack/EFT. The decrypted secret is only used server-side.
 */
export async function getPlatformPayPal(): Promise<PayPalCreds | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_payment_settings")
    .select(
      "paypal_enabled, paypal_environment, paypal_client_id, paypal_secret_cipher",
    )
    .eq("id", true)
    .maybeSingle();
  if (!data?.paypal_enabled) return null;
  if (!data.paypal_client_id || !data.paypal_secret_cipher) return null;
  try {
    return {
      clientId: data.paypal_client_id,
      secret: decryptSecret(data.paypal_secret_cipher),
      env: data.paypal_environment === "live" ? "live" : "test",
    };
  } catch {
    // A row that won't decrypt (e.g. PAYMENT_CIPHER_KEY rotated) is treated as
    // "no PayPal rail" rather than crashing checkout.
    return null;
  }
}
