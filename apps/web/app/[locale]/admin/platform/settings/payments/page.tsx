import { PaystackModeBadge } from "@/app/[locale]/admin/products/PaystackModeBadge";
import {
  PaymentSettingsForm,
  type PaymentSettings,
} from "@/app/[locale]/admin/products/payments/PaymentSettingsForm";
import { createAdminClient } from "@/lib/supabase/admin";

import { TestDataCard } from "./TestDataCard";

export const dynamic = "force-dynamic";

// Payments tab — how Wielo collects money for its own products (Paystack cards +
// manual EFT). This is the SAME singleton `platform_payment_settings` row the
// /admin/products/payments page edits, so the two stay in sync (two-way bound).
// The EFT section holds Wielo's bank account details (also printed on invoices).
export default async function PlatformPaymentSettingsPage() {
  const service = createAdminClient();
  const [{ data }, ledgerCount, invoiceCount, orderCount] = await Promise.all([
    service
      .from("platform_payment_settings")
      .select(
        "paystack_enabled, paystack_mode, paystack_secret_key, paystack_public_key, paystack_test_secret_key, paystack_test_public_key, eft_enabled, eft_bank_name, eft_account_name, eft_account_number, eft_branch_code, eft_reference_hint",
      )
      .eq("id", true)
      .maybeSingle(),
    service
      .from("platform_ledger")
      .select("id", { count: "exact", head: true })
      .eq("environment", "test"),
    service
      .from("wielo_invoices")
      .select("id", { count: "exact", head: true })
      .eq("environment", "test"),
    service
      .from("product_orders")
      .select("id", { count: "exact", head: true })
      .eq("environment", "test"),
  ]);

  const testCounts = {
    ledger: ledgerCount.count ?? 0,
    invoices: invoiceCount.count ?? 0,
    orders: orderCount.count ?? 0,
  };

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-base font-bold text-brand-ink">
          How Wielo gets paid
        </h2>
        <PaystackModeBadge
          enabled={initial.paystackEnabled}
          mode={initial.paystackMode}
        />
      </div>
      <p className="-mt-1 max-w-2xl text-[13px] text-brand-mute">
        Wielo&apos;s own Paystack account (cards) and manual EFT. Each product
        chooses which of these it accepts. The bank account below is printed on
        Wielo invoices as EFT payment instructions.
      </p>
      <PaymentSettingsForm initial={initial} />

      <div className="pt-2">
        <TestDataCard counts={testCounts} />
      </div>
    </div>
  );
}
