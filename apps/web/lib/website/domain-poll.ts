import "server-only";

import type { Database, Json } from "@vilo/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTransactionalEmail } from "@/lib/email/send";
import {
  getDomainConfig,
  vercelConfigured,
  verifyProjectDomain,
  type VercelVerification,
} from "@/lib/website/vercel";

// Shared custom-domain polling logic (W13) — the SSOT used by BOTH the
// `/api/website-domain-poll` cron worker and the host's manual "Refresh" action.
// Talks to Vercel, derives the domain/SSL status, persists it, and appends an
// INSERT-only `website_domain_events` row on each meaningful transition.

type Db = SupabaseClient<Database>;

export type DomainStatus =
  | "none"
  | "pending"
  | "verifying"
  | "active"
  | "error";
export type SslStatus = "none" | "pending" | "active" | "error";

export type DomainPollSite = {
  id: string;
  custom_domain: string | null;
  domain_status: string | null;
  ssl_status: string | null;
  // `unknown` so a Supabase `Json` settings column assigns without a cast.
  settings: unknown;
};

export type DomainPollResult = {
  ok: boolean;
  domainStatus: DomainStatus;
  sslStatus: SslStatus;
  verification: VercelVerification[];
  /** True when the integration secrets aren't set yet (inert, not an error). */
  notConfigured?: boolean;
};

/**
 * Poll one website's custom domain against Vercel and persist the result.
 *
 * Status mapping:
 *  - not verified (ownership TXT outstanding)        → `pending`
 *  - verified but DNS misconfigured / propagating    → `verifying`
 *  - verified + DNS correct                           → `active` (SSL auto-issued)
 */
export async function pollWebsiteDomain(
  sb: Db,
  site: DomainPollSite,
): Promise<DomainPollResult> {
  const domain = site.custom_domain?.trim();
  if (!domain) {
    return {
      ok: true,
      domainStatus: "none",
      sslStatus: "none",
      verification: [],
    };
  }

  if (!vercelConfigured()) {
    return {
      ok: false,
      notConfigured: true,
      domainStatus: (site.domain_status as DomainStatus) ?? "pending",
      sslStatus: (site.ssl_status as SslStatus) ?? "none",
      verification: [],
    };
  }

  const verifyRes = await verifyProjectDomain(domain);
  if (!verifyRes.ok) {
    await appendEvent(sb, site.id, "verify_failed", { error: verifyRes.error });
    await persist(sb, site, "error", "error", []);
    return {
      ok: false,
      domainStatus: "error",
      sslStatus: "error",
      verification: [],
    };
  }

  const { verified, verification } = verifyRes.data;

  let domainStatus: DomainStatus;
  let sslStatus: SslStatus;

  if (!verified) {
    domainStatus = "pending";
    sslStatus = "pending";
  } else {
    const cfg = await getDomainConfig(domain);
    const misconfigured = cfg.ok ? cfg.data.misconfigured : true;
    if (misconfigured) {
      domainStatus = "verifying";
      sslStatus = "pending";
    } else {
      domainStatus = "active";
      sslStatus = "active";
    }
  }

  // Event + owner email on first reaching active.
  if (domainStatus === "active" && site.domain_status !== "active") {
    await appendEvent(sb, site.id, "verified", { domain });
    await appendEvent(sb, site.id, "ssl_issued", { domain });
    await notifyDomainLive(sb, site.id, domain);
  }

  await persist(sb, site, domainStatus, sslStatus, verification);

  return { ok: true, domainStatus, sslStatus, verification };
}

async function persist(
  sb: Db,
  site: DomainPollSite,
  domainStatus: DomainStatus,
  sslStatus: SslStatus,
  verification: VercelVerification[],
): Promise<void> {
  const txt = verification.find((v) => v.type === "TXT");
  const settings = {
    ...((site.settings ?? {}) as Record<string, unknown>),
    domainChallenges: verification,
  };
  await sb
    .from("host_websites")
    .update({
      domain_status: domainStatus,
      ssl_status: sslStatus,
      verification_token: txt?.value ?? null,
      settings,
    })
    .eq("id", site.id);
}

/**
 * Best-effort "your custom domain is live" email to the site owner when a domain
 * first goes active. Resolves the owner via host_websites→hosts→user_profiles;
 * never throws (analytics/domain polling must not break on a mail failure).
 */
async function notifyDomainLive(
  sb: Db,
  websiteId: string,
  domain: string,
): Promise<void> {
  try {
    const { data: siteRow } = await sb
      .from("host_websites")
      .select("subdomain, brand, host_id")
      .eq("id", websiteId)
      .maybeSingle();
    if (!siteRow?.host_id) return;

    const { data: hostRow } = await sb
      .from("hosts")
      .select("user_id")
      .eq("id", siteRow.host_id)
      .maybeSingle();
    if (!hostRow?.user_id) return;

    const { data: prof } = await sb
      .from("user_profiles")
      .select("email")
      .eq("id", hostRow.user_id)
      .maybeSingle();
    const email = prof?.email;
    if (!email) return;

    const siteName =
      (siteRow.brand as { name?: string } | null)?.name?.trim() ||
      siteRow.subdomain;

    await sendTransactionalEmail({
      to: email,
      subject: `Your domain ${domain} is live`,
      html:
        `<p>Good news — <strong>${domain}</strong> is now connected to ${siteName} ` +
        `and secured with HTTPS.</p>` +
        `<p>Your website is live at <a href="https://${domain}">https://${domain}</a>.</p>`,
    });
  } catch {
    // best-effort — swallow.
  }
}

async function appendEvent(
  sb: Db,
  websiteId: string,
  event:
    | "domain_added"
    | "verified"
    | "ssl_issued"
    | "verify_failed"
    | "removed",
  detail: Record<string, unknown>,
): Promise<void> {
  await sb
    .from("website_domain_events")
    .insert({ website_id: websiteId, event, detail: detail as Json });
}
