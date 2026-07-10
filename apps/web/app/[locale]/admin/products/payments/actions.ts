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
      eft_reference_hint: d.eftReferenceHint || null,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite each secret when a new one is supplied (blank = keep).
    if (d.paystackSecretKey && d.paystackSecretKey.length > 0) {
      patch.paystack_secret_key = d.paystackSecretKey;
    }
    if (d.paystackTestSecretKey && d.paystackTestSecretKey.length > 0) {
      patch.paystack_test_secret_key = d.paystackTestSecretKey;
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
