import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { decryptAccountNumber } from "@/lib/crypto/banking";
import { createServerClient } from "@/lib/supabase/server";

import type { Account } from "../../banking/_components/BankAccountList";
import { BankAccountList } from "../../banking/_components/BankAccountList";
import type { BankAccountInput } from "../../banking/schemas";
import {
  BusinessForm,
  type BusinessFormValues,
} from "../_components/BusinessForm";

export const metadata: Metadata = {
  title: "Edit business · Settings",
};

export const dynamic = "force-dynamic";

type AccountType = BankAccountInput["account_type"];

function last4FromCipher(stored: string | null): string {
  if (!stored) return "????";
  try {
    const plain = decryptAccountNumber(stored).replace(/\D/g, "");
    return plain.length >= 4 ? plain.slice(-4) : plain.padStart(4, "•");
  } catch {
    return "????";
  }
}

export default async function BusinessDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) redirect("/dashboard/settings");

  const { data: biz } = await supabase
    .from("businesses")
    .select(
      "id, trading_name, legal_name, vat_number, company_registration_number, address_line1, address_line2, city, municipality, province, postal_code, country, latitude, longitude, logo_path, default_currency, default_language",
    )
    .eq("id", params.id)
    .eq("host_id", host.id)
    .maybeSingle();
  if (!biz) notFound();

  const t = await getTranslations("businesses");

  const { data: accountRows } = await supabase
    .from("eft_banking_details")
    .select(
      "id, label, bank_name, account_holder, account_number, account_type, branch_code, swift_code, reference_format, is_default, created_at",
    )
    .eq("business_id", biz.id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  const accounts: Account[] = (accountRows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    bank_name: row.bank_name,
    account_holder: row.account_holder,
    account_number_last4: last4FromCipher(row.account_number),
    account_type: row.account_type as AccountType,
    branch_code: row.branch_code,
    swift_code: row.swift_code,
    reference_format: row.reference_format,
    is_default: row.is_default,
  }));

  const logoUrl = biz.logo_path
    ? supabase.storage.from("host-logos").getPublicUrl(biz.logo_path).data
        .publicUrl
    : null;

  const initial: BusinessFormValues = {
    trading_name: biz.trading_name ?? "",
    legal_name: biz.legal_name ?? "",
    vat_number: biz.vat_number ?? "",
    company_registration_number: biz.company_registration_number ?? "",
    default_currency: biz.default_currency,
    default_language: biz.default_language,
    address_line1: biz.address_line1 ?? "",
    address_line2: biz.address_line2 ?? "",
    city: biz.city ?? "",
    municipality: biz.municipality ?? "",
    province: biz.province ?? "",
    postal_code: biz.postal_code ?? "",
    country: biz.country ?? "ZA",
    latitude: biz.latitude,
    longitude: biz.longitude,
  };

  return (
    <div className="space-y-6">
      <BusinessForm
        mode="edit"
        businessId={biz.id}
        initial={initial}
        logoUrl={logoUrl}
      />

      <section id="banking" className="space-y-2">
        <div>
          <h3 className="font-display text-base font-semibold text-brand-ink">
            {t("bankingTitle")}
          </h3>
          <p className="text-sm text-brand-mute">{t("bankingSubtitle")}</p>
        </div>
        <BankAccountList accounts={accounts} businessId={biz.id} />
      </section>
    </div>
  );
}
