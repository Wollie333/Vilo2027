import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { SetupWizard } from "./SetupWizard";

export const metadata: Metadata = {
  title: "Finish setting up · Vilo",
};

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: { step?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // We need the host row + draft listing + banking + business + photos +
  // rooms. The wizard is single-listing-scoped to the host's primary
  // listing (the one seeded during onboarding). If no host yet → bounce
  // to onboarding.
  const { data: host } = await supabase
    .from("hosts")
    .select(
      "id, handle, display_name, bio, avatar_url, languages_spoken, website_url, paystack_subaccount_code, default_policy_id",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) redirect("/signup/host");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, email, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // Primary listing — oldest one, the one seeded during onboarding. If a
  // host somehow has zero listings, we send them through /listings/new.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, name, listing_type, accommodation_type, experience_type, base_price, weekend_price, cleaning_fee, currency, max_guests, bedrooms, bathrooms, check_in_time, check_out_time, cancellation_policy, house_rules, is_published, booking_mode",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!listing) redirect("/dashboard/listings/new");

  // Banking + business — both nullable; the wizard handles "no row yet".
  const { data: bankAccounts } = await supabase
    .from("eft_banking_details")
    .select(
      "id, label, bank_name, account_holder, account_last4, branch_code, account_type, is_default",
    )
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("is_default", { ascending: false });

  const { data: businessDetails } = await supabase
    .from("host_business_details")
    .select(
      "legal_name, trading_name, vat_number, company_registration_number, billing_address_line1, billing_address_line2, billing_city, billing_postcode, billing_country",
    )
    .eq("host_id", host.id)
    .maybeSingle();

  const { data: photos } = await supabase
    .from("listing_photos")
    .select("id, url, sort_order")
    .eq("listing_id", listing.id)
    .order("sort_order", { ascending: true });

  const { data: rooms } = await supabase
    .from("listing_rooms")
    .select("id, name, bedrooms, bathrooms, max_guests, base_price, is_active")
    .eq("listing_id", listing.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  return (
    <SetupWizard
      requestedStep={searchParams?.step ?? null}
      host={{
        id: host.id,
        handle: host.handle,
        display_name: host.display_name,
        bio: host.bio ?? "",
        avatar_url: host.avatar_url ?? "",
        languages_spoken: host.languages_spoken ?? [],
        website_url: host.website_url ?? "",
        paystack_connected: Boolean(host.paystack_subaccount_code),
      }}
      profile={{
        full_name: profile?.full_name ?? host.display_name,
        email: profile?.email ?? user.email ?? "",
        phone: profile?.phone ?? "",
      }}
      emailVerified={Boolean(user.email_confirmed_at)}
      listing={{
        id: listing.id,
        name: listing.name,
        listing_type:
          (listing.listing_type as "accommodation" | "experience") ??
          "accommodation",
        accommodation_type: listing.accommodation_type ?? null,
        experience_type: listing.experience_type ?? null,
        base_price:
          listing.base_price == null ? null : Number(listing.base_price),
        weekend_price:
          listing.weekend_price == null ? null : Number(listing.weekend_price),
        cleaning_fee:
          listing.cleaning_fee == null ? null : Number(listing.cleaning_fee),
        currency: listing.currency ?? "ZAR",
        max_guests: listing.max_guests ?? null,
        bedrooms: listing.bedrooms ?? null,
        bathrooms: listing.bathrooms ?? null,
        check_in_time: listing.check_in_time ?? "",
        check_out_time: listing.check_out_time ?? "",
        cancellation_policy:
          (listing.cancellation_policy as
            | "flexible"
            | "moderate"
            | "strict"
            | null) ?? null,
        house_rules: listing.house_rules ?? "",
        is_published: Boolean(listing.is_published),
        booking_mode:
          (listing.booking_mode as
            | "whole_listing"
            | "rooms_only"
            | "flexible") ?? "whole_listing",
      }}
      bankAccounts={(bankAccounts ?? []).map((b) => ({
        id: b.id as string,
        label: b.label as string,
        bank_name: b.bank_name as string,
        account_holder: b.account_holder as string,
        account_last4: b.account_last4 as string,
        branch_code: b.branch_code as string,
        account_type: b.account_type as string,
        is_default: Boolean(b.is_default),
      }))}
      businessDetails={
        businessDetails
          ? {
              legal_name: (businessDetails.legal_name as string) ?? "",
              trading_name: (businessDetails.trading_name as string) ?? "",
              vat_number: (businessDetails.vat_number as string) ?? "",
              company_registration_number:
                (businessDetails.company_registration_number as string) ?? "",
              billing_address_line1:
                (businessDetails.billing_address_line1 as string) ?? "",
              billing_address_line2:
                (businessDetails.billing_address_line2 as string) ?? "",
              billing_city: (businessDetails.billing_city as string) ?? "",
              billing_postcode:
                (businessDetails.billing_postcode as string) ?? "",
              billing_country:
                (businessDetails.billing_country as string) ?? "ZA",
            }
          : null
      }
      photos={(photos ?? []).map((p) => ({
        id: p.id as string,
        url: p.url as string,
      }))}
      rooms={(rooms ?? []).map((r) => ({
        id: r.id as string,
        name: (r.name as string) ?? "Room",
        bedrooms: (r.bedrooms as number | null) ?? null,
        bathrooms: (r.bathrooms as number | null) ?? null,
        max_guests: (r.max_guests as number | null) ?? null,
        base_price: r.base_price == null ? null : Number(r.base_price),
        is_active: Boolean(r.is_active),
      }))}
    />
  );
}
