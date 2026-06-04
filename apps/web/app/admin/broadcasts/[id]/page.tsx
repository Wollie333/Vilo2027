import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/admin/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";

import { CancelButton } from "./CancelButton";

export const metadata: Metadata = {
  title: "Broadcast · Admin",
};

export const dynamic = "force-dynamic";

type Broadcast = {
  id: string;
  severity: string;
  audience: string;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  requires_ack: boolean;
  starts_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
  email_fanout_completed_at: string | null;
  created_at: string;
  created_by: string;
};

export default async function BroadcastDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("notifications.broadcast");
  const service = createAdminClient();
  const { data: broadcast } = await service
    .from("broadcast_announcements")
    .select(
      "id, severity, audience, title, body, link_url, link_label, requires_ack, starts_at, ends_at, cancelled_at, email_fanout_completed_at, created_at, created_by",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!broadcast) notFound();
  const b = broadcast as Broadcast;

  const [
    { count: ackedCount },
    { count: dismissedCount },
    { count: clickedCount },
    audienceSize,
  ] = await Promise.all([
    service
      .from("broadcast_acknowledgements")
      .select("user_id", { count: "exact", head: true })
      .eq("broadcast_id", b.id)
      .not("acknowledged_at", "is", null),
    service
      .from("broadcast_acknowledgements")
      .select("user_id", { count: "exact", head: true })
      .eq("broadcast_id", b.id)
      .not("dismissed_at", "is", null),
    service
      .from("broadcast_acknowledgements")
      .select("user_id", { count: "exact", head: true })
      .eq("broadcast_id", b.id)
      .not("link_clicked_at", "is", null),
    countAudience(service, b.audience),
  ]);

  const clicks = clickedCount ?? 0;
  const audience = audienceSize ?? 0;
  const ctrPct = audience > 0 ? ((clicks / audience) * 100).toFixed(1) : null;

  const isActive =
    !b.cancelled_at &&
    new Date(b.starts_at).getTime() <= Date.now() &&
    (!b.ends_at || new Date(b.ends_at).getTime() > Date.now());

  return (
    <section className="space-y-6">
      <header>
        <Link
          href="/admin/broadcasts"
          className="text-xs text-brand-mute hover:text-brand-ink"
        >
          ← Back to broadcasts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            {b.title}
          </h1>
          <Badge className={`border-0 capitalize ${severityClass(b.severity)}`}>
            {b.severity}
          </Badge>
          {b.cancelled_at ? (
            <Badge className="border-0 bg-zinc-200 text-zinc-700">
              cancelled
            </Badge>
          ) : isActive ? (
            <Badge className="border-0 bg-emerald-100 text-emerald-800">
              active
            </Badge>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <article className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-sm text-brand-mute">
            Audience:{" "}
            <span className="font-medium text-brand-ink">{b.audience}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-ink">
            {b.body}
          </p>
          {b.link_url ? (
            <div>
              <a
                href={b.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
              >
                {b.link_label ?? b.link_url}
              </a>
            </div>
          ) : null}
        </article>

        <aside className="space-y-4">
          <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-mute">
              Stats
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Stat label="Audience size" value={audience} />
              <Stat label="Acknowledged" value={ackedCount ?? 0} />
              <Stat label="Dismissed" value={dismissedCount ?? 0} />
              <Stat label="Link clicks" value={clicks} />
              <Stat label="CTR" value={ctrPct !== null ? `${ctrPct}%` : "—"} />
              <Stat
                label="Requires ack"
                value={b.requires_ack ? "yes" : "no"}
              />
              <Stat
                label="Email fanout"
                value={
                  b.severity === "critical"
                    ? b.email_fanout_completed_at
                      ? "completed"
                      : "pending"
                    : "n/a"
                }
              />
              <Stat
                label="Starts at"
                value={new Date(b.starts_at).toLocaleString()}
              />
              <Stat
                label="Ends at"
                value={
                  b.ends_at ? new Date(b.ends_at).toLocaleString() : "no end"
                }
              />
              <Stat
                label="Created"
                value={new Date(b.created_at).toLocaleString()}
              />
            </dl>
          </div>

          {!b.cancelled_at ? <CancelButton id={b.id} /> : null}
        </aside>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-brand-mute">{label}</dt>
      <dd className="text-sm font-medium text-brand-ink">{value}</dd>
    </div>
  );
}

function severityClass(severity: string): string {
  if (severity === "critical") return "bg-red-100 text-red-800";
  if (severity === "warning") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

// Computes audience size at view time. Same role-filter shape as the
// broadcast-fanout worker (lib/notifications/broadcast-fanout.ts) so the
// CTR denominator matches who actually got notified.
async function countAudience(
  service: ReturnType<typeof createAdminClient>,
  audience: string,
): Promise<number> {
  const roleFilter: string | null =
    audience === "all"
      ? null
      : audience === "hosts"
        ? "host"
        : audience === "guests"
          ? "guest"
          : audience === "staff"
            ? "staff"
            : audience === "super_admins"
              ? "super_admin"
              : null;

  let q = service
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .is("deleted_at", null);
  if (roleFilter) q = q.eq("role", roleFilter);
  const { count } = await q;
  return count ?? 0;
}
