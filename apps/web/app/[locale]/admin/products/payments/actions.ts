"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const PAY_SETTINGS_TARGET = "00000000-0000-0000-0000-0000000a7000";

const schema = z.object({
  paystackEnabled: z.boolean(),
  // Blank = keep the existing secret (we never echo it back to the client).
  paystackSecretKey: z.string().trim().max(200).optional().nullable(),
  paystackPublicKey: z.string().trim().max(200).optional().nullable(),
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
      paystack_public_key: d.paystackPublicKey || null,
      eft_enabled: d.eftEnabled,
      eft_bank_name: d.eftBankName || null,
      eft_account_name: d.eftAccountName || null,
      eft_account_number: d.eftAccountNumber || null,
      eft_branch_code: d.eftBranchCode || null,
      eft_reference_hint: d.eftReferenceHint || null,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the secret when a new one is supplied.
    if (d.paystackSecretKey && d.paystackSecretKey.length > 0) {
      patch.paystack_secret_key = d.paystackSecretKey;
    }

    const { error } = await service
      .from("platform_payment_settings")
      .update(patch)
      .eq("id", true);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/products/payments");
    return {
      result: { ok: true },
      after: { paystack: d.paystackEnabled, eft: d.eftEnabled },
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
