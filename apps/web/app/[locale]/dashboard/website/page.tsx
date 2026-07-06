import type { Metadata } from "next";
import { ArrowRight, Globe } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { hostHasFeature } from "@/lib/products/featureGate";
import { createServerClient } from "@/lib/supabase/server";
import {
  checkWebsiteReadiness,
  type ReadinessItem,
} from "@/lib/website/readiness";

import { CreateWebsiteButton } from "./_components/CreateWebsiteButton";
import { ReadinessChecklist } from "./_components/ReadinessChecklist";
import { WebsiteLocked } from "./_components/WebsiteLocked";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("website");
  return { title: t("metaTitle") };
}

type Biz = {
  id: string;
  trading_name: string | null;
  logo_path: string | null;
};
type Site = {
  id: string;
  business_id: string;
  subdomain: string;
  status: string;
};

export default async function WebsiteLandingPage() {
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

  const [t, canWebsite, { data: bizRows }] = await Promise.all([
    getTranslations("website"),
    hostHasFeature(host.id, "website_builder"),
    supabase
      .from("businesses")
      .select("id, trading_name, logo_path")
      .eq("host_id", host.id)
      .eq("is_archived", false)
      .order("is_default", { ascending: false }),
  ]);

  // W15 — gate the whole builder surface. A host without `website_builder`
  // sees the upgrade card instead of any create/manage affordance.
  if (!canWebsite) {
    return (
      <div className="space-y-6">
        <WebsiteHero title={t("heading")} subtitle={t("subheading")} />
        <WebsiteLocked />
      </div>
    );
  }

  const businesses = (bizRows ?? []) as Biz[];
  const businessIds = businesses.map((b) => b.id);

  let sites: Site[] = [];
  if (businessIds.length > 0) {
    const { data: siteRows } = await supabase
      .from("host_websites")
      .select("id, business_id, subdomain, status")
      .in("business_id", businessIds)
      .is("deleted_at", null);
    sites = (siteRows ?? []) as Site[];
  }
  const siteByBusiness = new Map(sites.map((s) => [s.business_id, s]));

  // Go-live readiness per site (Phase 6) — surface what's left before a site can
  // publish, right on the management row. Checked in parallel; the SSOT is shared
  // with the editor Publish gate.
  const readinessEntries = await Promise.all(
    sites.map(
      async (s) =>
        [
          s.id,
          (await checkWebsiteReadiness(supabase, host.id, s.id)).missing,
        ] as const,
    ),
  );
  const missingBySite = new Map<string, ReadinessItem[]>(readinessEntries);

  // Single business that already has a site → go straight to its editor.
  if (businesses.length === 1) {
    const only = siteByBusiness.get(businesses[0].id);
    if (only) redirect(`/dashboard/website/${only.id}`);
  }

  return (
    <div className="space-y-6">
      <WebsiteHero title={t("heading")} subtitle={t("subheading")} />

      {businesses.length === 0 ? (
        <p className="rounded-card border border-brand-line bg-white p-6 text-sm text-brand-mute shadow-card">
          {t("noBusinesses")}
        </p>
      ) : (
        <div className="space-y-4">
          {businesses.map((biz) => {
            const site = siteByBusiness.get(biz.id);
            const name = biz.trading_name?.trim() || t("metaTitle");
            return (
              <div
                key={biz.id}
                className="rounded-card border border-brand-line bg-white shadow-card"
              >
                {site ? (
                  <>
                    <ManageRow
                      name={name}
                      subdomain={site.subdomain}
                      status={site.status}
                      href={`/dashboard/website/${site.id}`}
                      manageLabel={t("manageCta")}
                      statusLabel={t(badgeKey(site.status))}
                    />
                    {(missingBySite.get(site.id)?.length ?? 0) > 0 ? (
                      <div className="border-t border-brand-line bg-brand-light/40 px-5 py-4">
                        <ReadinessChecklist
                          missing={missingBySite.get(site.id) ?? []}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <CreateWebsiteButton
                    businessId={biz.id}
                    businessName={name}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function badgeKey(status: string) {
  if (status === "published") return "publishedBadge" as const;
  if (status === "unpublished") return "unpublishedBadge" as const;
  return "draftBadge" as const;
}

function WebsiteHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section
      className="relative overflow-hidden rounded-card border border-brand-line p-7 text-white shadow-card md:p-8"
      style={{
        backgroundImage:
          "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-primary/30 blur-3xl"
      />
      <div className="relative max-w-2xl">
        <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
          <Globe className="h-3 w-3" />
          Website
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-brand-accent/80">
          {subtitle}
        </p>
      </div>
    </section>
  );
}

function ManageRow({
  name,
  subdomain,
  href,
  manageLabel,
  statusLabel,
}: {
  name: string;
  subdomain: string;
  status: string;
  href: string;
  manageLabel: string;
  statusLabel: string;
}) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-brand-ink">
            {name}
          </h2>
          <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
            {statusLabel}
          </span>
        </div>
        <div className="mt-0.5 font-mono text-[12px] text-brand-mute">
          {subdomain}.{root}
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
      >
        {manageLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
