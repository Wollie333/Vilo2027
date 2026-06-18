import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { createServerClient } from "@/lib/supabase/server";
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

type Db =
  | ReturnType<typeof createAdminClient>
  | ReturnType<typeof createServerClient>;

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

  // Event on first reaching active.
  if (domainStatus === "active" && site.domain_status !== "active") {
    await appendEvent(sb, site.id, "verified", { domain });
    await appendEvent(sb, site.id, "ssl_issued", { domain });
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
    .insert({ website_id: websiteId, event, detail });
}
