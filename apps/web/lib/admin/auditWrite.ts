import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The ONE place an `admin_audit_log` row is written (RULES.md §3 — single source
 * of truth). `withAdminAudit` covers the wrapped server actions; everything that
 * writes an audit row directly (impersonation start/end, permission denials,
 * staff edits of someone else's listing, self-service auth events) funnels
 * through `writeAuditRow` here rather than hand-rolling its own insert.
 *
 * Why this file exists: five call sites each built their own insert with a RAW
 * `x-forwarded-for` value and DISCARDED the returned `{ error }`. That is the
 * silent no-op pattern (RULES.md §8.1) applied to the audit log itself — the one
 * table whose whole purpose is to be trustworthy.
 */

/**
 * `admin_audit_log.ip_address` is a Postgres `inet`, which accepts only a bare
 * IPv4/IPv6 address. `x-forwarded-for` / `x-real-ip` routinely carry values that
 * do not cast — proven against the live database:
 *
 *   '102.65.1.1'      -> ok        '102.65.1.1:443'  -> ERROR (port)
 *   '::1'             -> ok        'unknown'         -> ERROR (proxies emit this)
 *   '2001:db8::1'     -> ok        'fe80::1%eth0'    -> ERROR (zone suffix)
 *
 * Return a clean address or null so the audit write never fails on the IP.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  const m4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::\d+)?$/);
  if (m4) {
    const octets = m4.slice(1, 5);
    return octets.every((o) => Number(o) <= 255) ? octets.join(".") : null;
  }
  if (v.includes(":") && /^[0-9a-fA-F:]+(?:\.\d{1,3}){0,3}$/.test(v)) return v;
  return null;
}

/** Caller IP + user agent for an audit row, normalised and safe to insert. */
export function requestAuditMeta(): {
  ip_address: string | null;
  user_agent: string | null;
} {
  const h = headers();
  return {
    ip_address: normalizeIp(
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
    ),
    user_agent: h.get("user-agent"),
  };
}

/** Columns a caller supplies. `ip_address`/`user_agent` are filled in here. */
export type AuditRow = {
  admin_id: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  impersonating?: string | null;
  payload?: unknown;
};

/**
 * Insert an audit row. Never throws in production — the mutation it records has
 * already committed, so a transient audit failure must not surface to the user.
 * But it never fails SILENTLY either: on error it retries without the IP (the
 * historic cause), then logs, and in dev/test it throws so a `target_type` /
 * CHECK-constraint / RLS mismatch can't hide the way it has before.
 *
 * Returns true if the row landed.
 */
export async function writeAuditRow(
  row: AuditRow,
  service: ReturnType<typeof createAdminClient> = createAdminClient(),
): Promise<boolean> {
  const meta = requestAuditMeta();

  const { error } = await service
    .from("admin_audit_log")
    .insert({ ...row, ...meta });
  if (!error) return true;

  // Retry without the IP: it is the only field derived from an untrusted header.
  const { error: retryErr } = await service
    .from("admin_audit_log")
    .insert({ ...row, user_agent: meta.user_agent });
  if (!retryErr) return true;

  console.error(
    `[admin-audit] failed to record ${row.action}: ${retryErr.message}`,
  );
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      `[admin-audit] ${row.action} was NOT recorded: ${retryErr.message}. ` +
        `The action itself succeeded. Check admin_audit_log_target_type_check ` +
        `covers target_type="${row.target_type}" and RLS allows the insert.`,
    );
  }
  return false;
}
