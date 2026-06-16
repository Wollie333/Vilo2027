import { ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  PaymentSettingsForm,
  type PaymentSettings,
} from "./PaymentSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminPaymentSettingsPage() {
  await requirePermission("platform.settings");
  const service = createAdminClient();

  const { data } = await service
    .from("platform_payment_settings")
    .select(
      "paystack_enabled, paystack_mode, paystack_secret_key, paystack_public_key, paystack_test_secret_key, paystack_test_public_key, eft_enabled, eft_bank_name, eft_account_name, eft_account_number, eft_branch_code, eft_reference_hint",
    )
    .eq("id", true)
    .maybeSingle();

  const initial: PaymentSettings = {
    paystackEnabled: data?.paystack_enabled ?? false,
    paystackMode: data?.paystack_mode === "test" ? "test" : "live",
    hasSecret: !!data?.paystack_secret_key,
    paystackPublicKey: data?.paystack_public_key ?? "",
    hasTestSecret: !!data?.paystack_test_secret_key,
    paystackTestPublicKey: data?.paystack_test_public_key ?? "",
    eftEnabled: data?.eft_enabled ?? false,
    eftBankName: data?.eft_bank_name ?? "",
    eftAccountName: data?.eft_account_name ?? "",
    eftAccountNumber: data?.eft_account_number ?? "",
    eftBranchCode: data?.eft_branch_code ?? "",
    eftReferenceHint: data?.eft_reference_hint ?? "",
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Vilo payment settings
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          How Vilo collects money for its products — its own Paystack account
          (cards) and manual EFT. Each product chooses which of these it
          accepts.
        </p>
      </header>
      <PaymentSettingsForm initial={initial} />
    </div>
  );
}
