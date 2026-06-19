import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import {
  dnsRecordsFor,
  isApex,
  normaliseDomain,
  type DnsRecord,
} from "@/lib/website/domain";
import { vercelConfigured } from "@/lib/website/vercel";

export type DomainEvent = {
  event: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type DomainData = {
  websiteId: string;
  subdomain: string;
  customDomain: string | null;
  domainStatus: string;
  sslStatus: string;
  /** DNS records the host must add (primary A/CNAME + any TXT challenges). */
  dnsRecords: DnsRecord[];
  events: DomainEvent[];
  /** Vercel secrets present — the connect flow is live (else inert). */
  configured: boolean;
  rootDomain: string;
  /** Preferred canonical host for a custom domain. */
  canonicalHost: "apex" | "www";
  /**
   * The apex/www choice only applies when the connected domain IS an apex or a
   * `www.` host (a `book.example.com`-style subdomain has no such pair).
   */
  canonicalApplicable: boolean;
};

/** Owner-scoped load of one website's custom-domain state. */
export async function loadDomainData(
  websiteId: string,
): Promise<DomainData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain, custom_domain, domain_status, ssl_status, settings")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const { data: eventRows } = await supabase
    .from("website_domain_events")
    .select("event, detail, created_at")
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(8);

  const settings = (site.settings ?? {}) as Record<string, unknown>;
  const challenges = Array.isArray(settings.domainChallenges)
    ? (settings.domainChallenges as Array<{
        type?: string;
        domain?: string;
        value?: string;
      }>)
    : [];
  const txtChallenges = challenges
    .filter((c) => (c.type ?? "TXT") === "TXT")
    .map((c) => ({ name: c.domain ?? "_vercel", value: c.value ?? "" }));

  const cd = site.custom_domain ? normaliseDomain(site.custom_domain) : "";
  const canonicalApplicable = Boolean(
    cd && (isApex(cd) || cd.startsWith("www.")),
  );

  return {
    websiteId: site.id,
    subdomain: site.subdomain,
    customDomain: site.custom_domain,
    domainStatus: site.domain_status ?? "none",
    sslStatus: site.ssl_status ?? "none",
    dnsRecords: site.custom_domain
      ? dnsRecordsFor(site.custom_domain, txtChallenges)
      : [],
    events: (eventRows ?? []).map((e) => ({
      event: e.event,
      detail: (e.detail ?? {}) as Record<string, unknown>,
      createdAt: e.created_at,
    })),
    configured: vercelConfigured(),
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN || "vilo.site",
    canonicalHost: settings.canonicalHost === "www" ? "www" : "apex",
    canonicalApplicable,
  };
}
