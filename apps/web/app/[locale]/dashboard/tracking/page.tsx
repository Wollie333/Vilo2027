import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { TrackingForm } from "./TrackingForm";

export const metadata: Metadata = {
  title: "Tracking · Insights",
};

export const dynamic = "force-dynamic";

type Analytics = {
  metaPixel?: string;
  ga4?: string;
  gtm?: string;
  tiktok?: string;
  googleAds?: string;
  cookieConsent?: { enabled?: boolean; message?: string; privacyHref?: string };
};

export default async function TrackingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <EmptyState
        title="Sign in to manage tracking"
        body="You need a host account to add analytics and pixels."
      />
    );
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) {
    return (
      <EmptyState
        title="Create your host profile first"
        body="Finish host onboarding to unlock tracking."
        ctaLabel="Finish onboarding"
        ctaHref="/signup/host"
      />
    );
  }

  const { data: site } = await supabase
    .from("host_websites")
    .select(
      "id, subdomain, custom_domain, settings, meta_capi_enabled, meta_capi_access_token",
    )
    .eq("host_id", host.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!site) {
    return (
      <EmptyState
        title="Set up your website first"
        body="Pixels and analytics attach to your public booking site. Create it, then add your tracking here."
        ctaLabel="Create website"
        ctaHref="/dashboard/website"
      />
    );
  }

  const a = ((site.settings as { analytics?: Analytics } | null)?.analytics ??
    {}) as Analytics;
  const consent = a.cookieConsent ?? {};
  const siteLabel =
    (site.custom_domain as string | null) ||
    (site.subdomain ? `${site.subdomain}.wielo.site` : "your website");

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Radar className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
            Tracking
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-mute">
            Add your own pixels and analytics — they load on your public booking
            site so you can measure traffic and run retargeting. Consent-gated
            by default; nothing fires until a visitor accepts.
          </p>
        </div>
      </header>

      <TrackingForm
        websiteId={site.id as string}
        siteLabel={siteLabel}
        capiTokenSet={Boolean(site.meta_capi_access_token)}
        initial={{
          metaPixel: a.metaPixel ?? "",
          ga4: a.ga4 ?? "",
          gtm: a.gtm ?? "",
          tiktok: a.tiktok ?? "",
          googleAds: a.googleAds ?? "",
          cookieConsentEnabled: consent.enabled ?? true,
          cookieConsentMessage: consent.message ?? "",
          privacyHref: consent.privacyHref ?? "",
          metaCapiEnabled: Boolean(site.meta_capi_enabled),
        }}
      />
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-card border border-dashed border-brand-line bg-white p-8 text-center shadow-card">
      <h2 className="font-display text-lg font-bold text-brand-ink">{title}</h2>
      {body ? <p className="mt-2 text-sm text-brand-mute">{body}</p> : null}
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center justify-center rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
