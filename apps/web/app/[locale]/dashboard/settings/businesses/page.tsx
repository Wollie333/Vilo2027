import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createServerClient } from "@/lib/supabase/server";

import {
  BusinessesList,
  type BusinessListItem,
} from "./_components/BusinessesList";
import { PersonalAddressCard } from "./_components/PersonalAddressCard";
import { EMPTY_ADDRESS, type AddressValue } from "./_components/AddressFields";

export const metadata: Metadata = {
  title: "Businesses · Settings",
};

export const dynamic = "force-dynamic";

export default async function BusinessesSettingsPage() {
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

  const t = await getTranslations("businesses");

  const [
    { data: bizRows },
    { data: listingRows },
    { data: bankRows },
    { data: personal },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id, trading_name, legal_name, vat_number, city, province, country, default_currency, default_language, is_default, logo_path",
      )
      .eq("host_id", host.id)
      .eq("is_archived", false)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("listings")
      .select("business_id")
      .eq("host_id", host.id)
      .is("deleted_at", null),
    supabase
      .from("eft_banking_details")
      .select("business_id")
      .eq("host_id", host.id)
      .eq("is_archived", false),
    supabase
      .from("host_personal_details")
      .select(
        "address_line1, address_line2, city, municipality, province, postal_code, country, latitude, longitude",
      )
      .eq("host_id", host.id)
      .maybeSingle(),
  ]);

  const counts = new Map<string, number>();
  for (const l of listingRows ?? []) {
    if (l.business_id)
      counts.set(l.business_id, (counts.get(l.business_id) ?? 0) + 1);
  }

  const withBanking = new Set<string>();
  for (const a of bankRows ?? []) {
    if (a.business_id) withBanking.add(a.business_id);
  }

  const businesses: BusinessListItem[] = (bizRows ?? []).map((b) => ({
    id: b.id,
    trading_name: b.trading_name,
    legal_name: b.legal_name,
    vat_number: b.vat_number,
    city: b.city,
    province: b.province,
    country: b.country,
    default_currency: b.default_currency,
    default_language: b.default_language,
    is_default: b.is_default,
    listing_count: counts.get(b.id) ?? 0,
    has_banking: withBanking.has(b.id),
    logo_url: b.logo_path
      ? supabase.storage.from("host-logos").getPublicUrl(b.logo_path).data
          .publicUrl
      : null,
  }));

  const personalAddress: AddressValue = personal
    ? {
        address_line1: personal.address_line1 ?? "",
        address_line2: personal.address_line2 ?? "",
        city: personal.city ?? "",
        municipality: personal.municipality ?? "",
        province: personal.province ?? "",
        postal_code: personal.postal_code ?? "",
        country: personal.country ?? "ZA",
        latitude: personal.latitude,
        longitude: personal.longitude,
      }
    : EMPTY_ADDRESS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("subtitle")}</p>
      </div>

      <BusinessesList businesses={businesses} />
      <PersonalAddressCard initial={personalAddress} />
    </div>
  );
}
