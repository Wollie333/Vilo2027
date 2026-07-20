"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { encryptSecret } from "@/lib/crypto/payments";

const PAY_SETTINGS_TARGET = "00000000-0000-0000-0000-0000000a7000";

const schema = z.object({
  paystackEnabled: z.boolean(),
  paystackMode: z.enum(["live", "test"]),
  // Blank = keep the existing secret (we never echo it back to the client).
  paystackSecretKey: z.string().trim().max(200).optional().nullable(),
  paystackPublicKey: z.string().trim().max(200).optional().nullable(),
  paystackTestSecretKey: z.string().trim().max(200).optional().nullable(),
  paystackTestPublicKey: z.string().trim().max(200).optional().nullable(),
  paypalEnabled: z.boolean(),
  paypalEnvironment: z.enum(["live", "test"]),
  paypalClientId: z.string().trim().max(200).optional().nullable(),
  // Blank = keep the existing secret (we never echo it back to the client).
  paypalSecret: z.string().trim().max(400).optional().nullable(),
  eftEnabled: z.boolean(),
  eftBankName: z.string().trim().max(120).optional().nullable(),
  eftAccountName: z.string().trim().max(120).optional().nullable(),
  eftAccountNumber: z.string().trim().max(60).optional().nullable(),
  eftBranchCode: z.string().trim().max(40).optional().nullable(),
  eftSwiftCode: z.string().trim().max(20).optional().nullable(),
  eftReferenceHint: z.string().trim().max(200).optional().nullable(),
  reason: z.string().optional(),
});

export type SavePaymentSettingsInput = z.infer<typeof schema>;

export const savePaymentSettingsAction = withAdminAudit<
  SavePaymentSettingsInput,
  { ok: true }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.payment_settings",
    targetType: "platform_setting",
    getTargetId: () => PAY_SETTINGS_TARGET,
  },
  async (args, service) => {
    const parsed = schema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const d = parsed.data;

    // Existing row — needed both for the mode/key guard below and so a blank
    // secret keeps the stored one.
    const { data: existing } = await service
      .from("platform_payment_settings")
      .select("paystack_secret_key, paystack_test_secret_key")
      .eq("id", true)
      .maybeSingle();

    // Mode/key guard: refuse to enable a Paystack mode that has no secret for it
    // (neither newly entered, already stored, nor a matching env key). Without
    // this the reader silently falls back to PAYSTACK_SECRET_KEY and the charged
    // environment is derived from that key's prefix — so the DB toggle and the
    // real environment can diverge.
    if (d.paystackEnabled) {
      const envKey = process.env.PAYSTACK_SECRET_KEY ?? "";
      const hasLive =
        !!d.paystackSecretKey ||
        !!existing?.paystack_secret_key ||
        envKey.startsWith("sk_live_");
      const hasTest =
        !!d.paystackTestSecretKey ||
        !!existing?.paystack_test_secret_key ||
        envKey.startsWith("sk_test_");
      if (d.paystackMode === "live" && !hasLive) {
        throw new Error(
          "You selected Live mode but no live Paystack secret key is set. Enter the live key or switch to Test.",
        );
      }
      if (d.paystackMode === "test" && !hasTest) {
        throw new Error(
          "You selected Test mode but no test Paystack secret key is set. Enter the test key or switch to Live.",
        );
      }
    }

    const patch: Record<string, unknown> = {
      paystack_enabled: d.paystackEnabled,
      paystack_mode: d.paystackMode,
      paystack_public_key: d.paystackPublicKey || null,
      paystack_test_public_key: d.paystackTestPublicKey || null,
      paypal_enabled: d.paypalEnabled,
      paypal_environment: d.paypalEnvironment,
      paypal_client_id: d.paypalClientId || null,
      eft_enabled: d.eftEnabled,
      eft_bank_name: d.eftBankName || null,
      eft_account_name: d.eftAccountName || null,
      eft_account_number: d.eftAccountNumber || null,
      eft_branch_code: d.eftBranchCode || null,
      eft_swift_code: d.eftSwiftCode || null,
      eft_reference_hint: d.eftReferenceHint || null,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite each secret when a new one is supplied (blank = keep).
    // Encrypt at rest (AES-256-GCM via PAYMENT_CIPHER_KEY) like the PayPal
    // secret — encryptSecret is a transparent no-op when the key is unset, and
    // the reader + webhook decrypt via decryptSecret (plaintext passes through,
    // so existing keys keep working until re-saved).
    if (d.paystackSecretKey && d.paystackSecretKey.length > 0) {
      patch.paystack_secret_key = encryptSecret(d.paystackSecretKey);
    }
    if (d.paystackTestSecretKey && d.paystackTestSecretKey.length > 0) {
      patch.paystack_test_secret_key = encryptSecret(d.paystackTestSecretKey);
    }
    // PayPal secret: encrypt at rest (AES-256-GCM, or plaintext passthrough when
    // PAYMENT_CIPHER_KEY is unset — same as host gateway secrets). Blank = keep.
    if (d.paypalSecret && d.paypalSecret.length > 0) {
      patch.paypal_secret_cipher = encryptSecret(d.paypalSecret);
    }

    const { data: updated, error } = await service
      .from("platform_payment_settings")
      .update(patch)
      .eq("id", true)
      .select("id");
    if (error) throw new Error(error.message);
    // .update matches 0 rows silently if the singleton is missing — surface it
    // rather than reporting a successful save that persisted nothing.
    if (!updated || updated.length === 0) {
      throw new Error(
        "Payment settings row missing — reseed platform_payment_settings (id=true).",
      );
    }

    revalidatePath("/admin/products/payments");
    return {
      result: { ok: true },
      after: {
        paystack: d.paystackEnabled,
        paypal: d.paypalEnabled,
        eft: d.eftEnabled,
      },
    };
  },
);

type Res = { ok: true } | { ok: false; error: string };
export async function savePaymentSettings(
  input: SavePaymentSettingsInput,
): Promise<Res> {
  try {
    await savePaymentSettingsAction(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// WS-5 — toggle the Founding-offers window. While ON, a host converting to the
// paid plan is auto-priced at the Founding rate and gets the lifetime lock.
export const setFoundingOffersOpenAction = withAdminAudit<
  { open: boolean; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.founding_offers_open",
    targetType: "platform_setting",
    getTargetId: () => PAY_SETTINGS_TARGET,
  },
  async (args, service) => {
    const { error } = await service
      .from("platform_payment_settings")
      .update({
        founding_offers_open: args.open === true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/products/payments");
    return { result: { ok: true }, after: { founding_offers_open: args.open } };
  },
);

export async function setFoundingOffersOpen(open: boolean): Promise<Res> {
  try {
    await setFoundingOffersOpenAction({ open });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
