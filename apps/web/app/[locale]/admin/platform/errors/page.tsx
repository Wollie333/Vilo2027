import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { CONFIG_GROUPS, configHealth } from "@/lib/observability/configHealth";
import { createAdminClient } from "@/lib/supabase/admin";

import { ResolveButton } from "./ResolveButton";

export const dynamic = "force-dynamic";

type ErrorRow = {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  url: string | null;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
};

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Somewhere to actually SEE what broke. Errors were captured by nothing before
// this, so the first anyone knew of a production failure was a customer
// mentioning it — if they bothered, rather than just leaving.
export default async function AdminErrorsPage() {
  // `platform.settings` (ops + super_admin), not a bare requireAdmin(): this page
  // renders configHealth(), which reports WHICH platform secrets are configured.
  // An `is_active`-only check let any staff member of any role — content_mod,
  // support_agent, finance — read that and resolve error events
  // (AGENT_RULES.md §6.4: capability checks via the DB, never `is_active` alone).
  await requirePermission("platform.settings");
  const service = createAdminClient();
  const checks = configHealth();

  const { data } = await service
    .from("error_events")
    .select(
      "id, source, message, stack, url, occurrences, first_seen, last_seen, resolved_at",
    )
    .order("last_seen", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as ErrorRow[];
  const open = rows.filter((r) => !r.resolved_at);
  const resolved = rows.filter((r) => r.resolved_at);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Runtime errors
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Server, client and worker failures, grouped so a repeat bumps a count
          instead of flooding the list. Resolving one hides it until it happens
          again.
        </p>
      </header>

      {/* Configuration presence, read from the environment this server actually
          has. Loading this page on production is evidence; reading a local
          .env file is not. Presence only — never a value. */}
      <section className="rounded-card border border-brand-line bg-white p-4 shadow-card">
        <h2 className="font-display text-sm font-semibold text-brand-ink">
          Configuration
        </h2>
        <p className="mt-0.5 text-[12px] text-brand-mute">
          Whether each setting is present on <strong>this</strong> server —
          secrets show presence only, never a value. The two public URLs show
          theirs, because &ldquo;set&rdquo; and &ldquo;correct&rdquo; are not
          the same thing for a URL. Secrets used by Supabase Edge Functions (the
          payment webhooks) live in a different runtime and cannot be checked
          from here.
        </p>
        {CONFIG_GROUPS.map((group) => {
          const groupRows = checks.filter((c) => c.group === group);
          if (groupRows.length === 0) return null;
          const missing = groupRows.filter((r) => !r.present).length;
          return (
            <div key={group} className="mt-4">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                  {group}
                </h3>
                <span className="text-[11px] text-brand-mute">
                  {groupRows.length - missing}/{groupRows.length} set
                </span>
              </div>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {groupRows.map((c) => (
                  <li key={c.key} className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        c.present
                          ? "bg-[#047857]"
                          : c.severity === "critical"
                            ? "bg-[#B42318]"
                            : "bg-[#B45309]"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-brand-ink">
                        {c.label}
                      </span>
                      <span className="ml-1.5 font-mono text-[11px] text-brand-mute">
                        {c.key}
                      </span>
                      {/* Non-secret NEXT_PUBLIC_ URLs show their VALUE — "set" is not
                    the same as "correct" for a URL, and a wrong one still
                    sends. Everything else reports presence only. */}
                      {c.value ? (
                        <p className="break-all font-mono text-[11.5px] leading-snug text-brand-ink">
                          {c.value}
                        </p>
                      ) : null}
                      {!c.present ? (
                        <p className="text-[11.5px] leading-snug text-brand-mute">
                          {c.impact}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {open.length === 0 ? (
        <div className="flex items-center gap-3 rounded-card border border-[#C7F0DC] bg-[#ECFDF5] p-4">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#047857]" />
          <p className="text-[13px] text-[#047857]">
            No open errors.{" "}
            {rows.length === 0 ? "Nothing has been recorded yet." : null}
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          {open.map((r) => (
            <article
              key={r.id}
              className="rounded-card border border-brand-line bg-white p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B42318]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-pill border border-brand-line px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-mute">
                      {r.source}
                    </span>
                    {r.occurrences > 1 ? (
                      <span className="rounded-pill bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#B42318]">
                        ×{r.occurrences}
                      </span>
                    ) : null}
                    <span className="text-[11.5px] text-brand-mute">
                      {ago(r.last_seen)}
                    </span>
                  </div>
                  <p className="mt-1.5 break-words font-medium text-brand-ink">
                    {r.message}
                  </p>
                  {r.url ? (
                    <p className="mt-0.5 break-all font-mono text-[12px] text-brand-mute">
                      {r.url}
                    </p>
                  ) : null}
                  {r.stack ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] font-semibold text-brand-primary">
                        Stack
                      </summary>
                      <pre className="rounded-input mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap bg-brand-light/60 p-3 font-mono text-[11.5px] leading-relaxed text-brand-mute">
                        {r.stack}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <ResolveButton id={r.id} />
              </div>
            </article>
          ))}
        </section>
      )}

      {resolved.length > 0 ? (
        <section>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Resolved ({resolved.length})
          </h2>
          <ul className="divide-y divide-brand-line rounded-card border border-brand-line bg-white">
            {resolved.map((r) => (
              <li
                key={r.id}
                className="px-4 py-2.5 text-[13px] text-brand-mute"
              >
                <span className="capitalize">{r.source}</span> · {r.message}
                <span className="ml-2 text-[11.5px]">×{r.occurrences}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
