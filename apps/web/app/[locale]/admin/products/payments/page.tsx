import { ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { PaystackModeBadge } from "../PaystackModeBadge";
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
      "paystack_enabled, paystack_mode, paystack_secret_key, paystack_public_key, paystack_test_secret_key, paystack_test_public_key, paypal_enabled, paypal_environment, paypal_client_id, paypal_secret_cipher, eft_enabled, eft_bank_name, eft_account_name, eft_account_number, eft_branch_code, eft_reference_hint",
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
    paypalEnabled: data?.paypal_enabled ?? false,
    paypalEnvironment: data?.paypal_environment === "live" ? "live" : "test",
    paypalClientId: data?.paypal_client_id ?? "",
    hasPaypalSecret: !!data?.paypal_secret_cipher,
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Wielo payment settings
          </h1>
          <PaystackModeBadge
            enabled={initial.paystackEnabled}
            mode={initial.paystackMode}
          />
        </div>
        <p className="mt-1 text-[13px] text-brand-mute">
          How Wielo collects money for its products — its own Paystack account
          (cards), PayPal, and manual EFT. Each product chooses which of these
          it accepts.
        </p>
      </header>
      <PaymentSettingsForm initial={initial} />
    </div>
  );
}
