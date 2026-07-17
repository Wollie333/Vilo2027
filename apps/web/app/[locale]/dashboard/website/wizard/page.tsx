import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { hostHasFeature } from "@/lib/products/featureGate";
import { loadActiveThemes } from "@/lib/site/themes.server";
import { createServerClient } from "@/lib/supabase/server";
import { deriveSubdomain } from "@/lib/website/subdomain";

import {
  loadWizardPaymentMethods,
  loadWizardPolicies,
  loadWizardRooms,
} from "../_wizard/loadWizardAccount";
import { WebsiteWizard } from "../_wizard/WebsiteWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("website");
  return { title: t("wizardPageTitle") };
}

type Biz = {
  id: string;
  trading_name: string | null;
  logo_path: string | null;
};

// Full-page setup wizard (runs inside the dashboard, not a modal). Reached from
// the website landing "Create website" card as ?business=<id>. Guards mirror the
// landing page: auth → host → feature gate → a real, website-less business.
export default async function WebsiteWizardPage({
  searchParams,
}: {
  searchParams: { business?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/website");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) redirect("/dashboard");

  const canWebsite = await hostHasFeature(host.id, "website_builder");
  if (!canWebsite) redirect("/dashboard/website");

  const { data: bizRows } = await supabase
    .from("businesses")
    .select("id, trading_name, logo_path")
    .eq("host_id", host.id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false });
  const businesses = (bizRows ?? []) as Biz[];
  if (businesses.length === 0) redirect("/dashboard/website");

  // Target business: the ?business param, else the default (first) one.
  const target = searchParams.business
    ? businesses.find((b) => b.id === searchParams.business)
    : businesses[0];
  if (!target) redirect("/dashboard/website");

  // One site per business — if it already has one, the wizard bounces to that
  // site's editor CLIENT-SIDE (see WebsiteWizard). This is NOT a server redirect
  // because a server action re-renders this page right after the wizard creates
  // the site — a server redirect here would then fire and skip the success
  // screen. The client only bounces on the id present at MOUNT, so a freshly
  // created site keeps the success screen up until the host clicks through.
  const { data: existing } = await supabase
    .from("host_websites")
    .select("id")
    .eq("business_id", target.id)
    .is("deleted_at", null)
    .maybeSingle();

  const [t, themes, paymentMethods, policies, rooms] = await Promise.all([
    getTranslations("website"),
    loadActiveThemes(),
    loadWizardPaymentMethods(supabase, host.id, target.id),
    loadWizardPolicies(supabase, host.id),
    loadWizardRooms(supabase, target.id),
  ]);
  const name = target.trading_name?.trim() || t("metaTitle");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {t("wizardPageTitle")}
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          {t("wizardPageSubtitle", { business: name })}
        </p>
      </div>
      <WebsiteWizard
        businessId={target.id}
        defaultName={name}
        defaultSubdomain={deriveSubdomain(name)}
        logoPath={target.logo_path}
        themes={themes}
        paymentMethods={paymentMethods}
        policies={policies}
        rooms={rooms}
        existingWebsiteId={existing?.id ?? null}
      />
    </div>
  );
}
