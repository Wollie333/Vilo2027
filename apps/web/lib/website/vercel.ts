import "server-only";

// Thin wrapper over the Vercel Domains API (plan §3). Used by the custom-domain
// connect action + the poll worker. SERVER/edge ONLY — VERCEL_TOKEN must never
// reach the client.
//
// Inert until the founder sets the secrets (mirrors the W5 middleware on-switch):
// `vercelConfigured()` is false without VERCEL_TOKEN + VERCEL_PROJECT_ID, and the
// connect action surfaces a "not configured" error rather than throwing. See
// WEBSITE_HOSTING.md for the one-time ops setup.

const API = "https://api.vercel.com";

type VercelEnv = { token: string; projectId: string; teamId?: string };

function readEnv(): VercelEnv | null {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID || undefined };
}

/** True once the founder has wired the Vercel secrets (see WEBSITE_HOSTING.md). */
export function vercelConfigured(): boolean {
  return readEnv() !== null;
}

export type VercelVerification = {
  type: string; // usually "TXT"
  domain: string;
  value: string;
  reason?: string;
};

export type VercelDomainState = {
  /** Vercel considers the domain owned + attached to the project. */
  verified: boolean;
  /** Pending ownership/DNS challenges to satisfy. */
  verification: VercelVerification[];
};

export type VercelResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function vercelFetch(
  env: VercelEnv,
  path: string,
  init?: RequestInit,
): Promise<VercelResult<unknown>> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${env.teamId ? `${sep}teamId=${env.teamId}` : ""}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "network" };
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const code =
      (json as { error?: { code?: string } } | null)?.error?.code ??
      "vercel_error";
    return { ok: false, error: code, status: res.status };
  }
  return { ok: true, data: json };
}

/** Attach a domain to the Vercel project. Returns its ownership challenges. */
export async function addDomainToProject(
  domain: string,
): Promise<VercelResult<VercelDomainState>> {
  const env = readEnv();
  if (!env) return { ok: false, error: "not_configured" };
  const res = await vercelFetch(env, `/v10/projects/${env.projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  // 409 = already added to this project: treat as success and read its state.
  if (!res.ok && res.status !== 409) return res;
  return getProjectDomain(domain);
}

/** Read a project domain's verification state. */
export async function getProjectDomain(
  domain: string,
): Promise<VercelResult<VercelDomainState>> {
  const env = readEnv();
  if (!env) return { ok: false, error: "not_configured" };
  const res = await vercelFetch(
    env,
    `/v9/projects/${env.projectId}/domains/${domain}`,
  );
  if (!res.ok) return res;
  const d = res.data as {
    verified?: boolean;
    verification?: VercelVerification[];
  };
  return {
    ok: true,
    data: {
      verified: Boolean(d.verified),
      verification: Array.isArray(d.verification) ? d.verification : [],
    },
  };
}

/** Ask Vercel to re-check ownership (after the host adds the TXT record). */
export async function verifyProjectDomain(
  domain: string,
): Promise<VercelResult<VercelDomainState>> {
  const env = readEnv();
  if (!env) return { ok: false, error: "not_configured" };
  const res = await vercelFetch(
    env,
    `/v9/projects/${env.projectId}/domains/${domain}/verify`,
    { method: "POST" },
  );
  if (!res.ok) return res;
  const d = res.data as {
    verified?: boolean;
    verification?: VercelVerification[];
  };
  return {
    ok: true,
    data: {
      verified: Boolean(d.verified),
      verification: Array.isArray(d.verification) ? d.verification : [],
    },
  };
}

/** Whether the live DNS for a domain points at Vercel correctly. */
export async function getDomainConfig(
  domain: string,
): Promise<VercelResult<{ misconfigured: boolean }>> {
  const env = readEnv();
  if (!env) return { ok: false, error: "not_configured" };
  const res = await vercelFetch(env, `/v6/domains/${domain}/config`);
  if (!res.ok) return res;
  const d = res.data as { misconfigured?: boolean };
  return { ok: true, data: { misconfigured: Boolean(d.misconfigured) } };
}

/** Detach a domain from the Vercel project. */
export async function removeDomainFromProject(
  domain: string,
): Promise<VercelResult<true>> {
  const env = readEnv();
  if (!env) return { ok: false, error: "not_configured" };
  const res = await vercelFetch(
    env,
    `/v9/projects/${env.projectId}/domains/${domain}`,
    { method: "DELETE" },
  );
  // 404 = already gone — idempotent success.
  if (!res.ok && res.status !== 404) return res;
  return { ok: true, data: true };
}
