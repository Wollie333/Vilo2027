import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";

import { VerifyButton } from "./VerifyButton";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AdminHostDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("hosts.verify");
  const service = createAdminClient();

  const { data: host } = await service
    .from("hosts")
    .select(
      "id, user_id, handle, display_name, bio, is_verified, is_active, total_bookings, total_reviews, avg_rating, response_rate, created_at, deleted_at, website_url",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!host) notFound();

  const [{ data: profile }, { count: listingsCount }, { data: sub }] =
    await Promise.all([
      service
        .from("user_profiles")
        .select("email, full_name, phone")
        .eq("id", host.user_id)
        .maybeSingle(),
      service
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id)
        .is("deleted_at", null),
      service
        .from("subscriptions")
        .select("plan, status, billing_cycle, current_period_end")
        .eq("host_id", host.id)
        .maybeSingle(),
    ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/hosts"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All hosts
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-brand-ink">
              {host.display_name}
            </h1>
            {host.is_verified ? (
              <span className="inline-flex items-center rounded-pill bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                Verified
              </span>
            ) : null}
            {!host.is_active ? (
              <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[11px] font-medium text-status-cancelled">
                Inactive
              </span>
            ) : null}
          </div>
          <div className="mt-1 font-mono text-xs text-brand-mute">
            @{host.handle}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${host.handle}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            Public page
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href={`/admin/as/${host.user_id}/dashboard`}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            View as host
          </Link>
          <VerifyButton hostId={host.id} isVerified={host.is_verified} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Profile
            </div>
            <dl className="mt-3 space-y-3 text-sm">
              <Detail label="Owner">
                {profile?.full_name ?? "—"}{" "}
                {profile?.email ? (
                  <Link
                    href={`/admin/users/${host.user_id}`}
                    className="ml-2 text-[12px] text-brand-primary underline-offset-2 hover:underline"
                  >
                    open user
                  </Link>
                ) : null}
              </Detail>
              <Detail label="Email">
                <span className="font-mono text-xs">
                  {profile?.email ?? "—"}
                </span>
              </Detail>
              <Detail label="Phone">
                <span className="font-mono text-xs">
                  {profile?.phone ?? "—"}
                </span>
              </Detail>
              <Detail label="Website">
                {host.website_url ? (
                  <a
                    href={host.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-primary underline-offset-2 hover:underline"
                  >
                    {host.website_url}
                  </a>
                ) : (
                  "—"
                )}
              </Detail>
              {host.bio ? (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    Bio
                  </dt>
                  <dd className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-brand-dark">
                    {host.bio}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Performance
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Listings" value={listingsCount ?? 0} />
              <Stat label="Bookings" value={host.total_bookings ?? 0} />
              <Stat label="Reviews" value={host.total_reviews ?? 0} />
              <Stat
                label="Rating"
                value={
                  Number(host.avg_rating ?? 0) > 0
                    ? Number(host.avg_rating ?? 0).toFixed(1)
                    : "—"
                }
                icon={Star}
              />
            </dl>
            <div className="mt-3 text-[12px] text-brand-mute">
              Response rate{" "}
              <span className="num font-medium text-brand-ink">
                {Math.round(Number(host.response_rate ?? 0) * 100)}%
              </span>{" "}
              over the last 90 days.
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Subscription
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Detail label="Plan">
                <span className="font-medium capitalize">
                  {sub?.plan ?? "—"}
                </span>
              </Detail>
              <Detail label="Status">
                <span className="capitalize">{sub?.status ?? "—"}</span>
              </Detail>
              <Detail label="Renews">
                {fmtDate(sub?.current_period_end) ?? "—"}
              </Detail>
            </dl>
          </section>

          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Timestamps
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-brand-ink">Created</span>
                <span className="font-mono text-xs text-brand-mute">
                  {fmtDate(host.created_at) ?? "—"}
                </span>
              </div>
              {host.deleted_at ? (
                <div className="flex items-center justify-between text-status-cancelled">
                  <span className="font-medium">Deleted</span>
                  <span className="font-mono text-xs">
                    {fmtDate(host.deleted_at)}
                  </span>
                </div>
              ) : null}
            </dl>
          </section>

          <Link
            href={`/admin/audit?target_type=host&target_id=${host.id}`}
            className="block rounded border border-brand-line bg-white px-3 py-2 text-center text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            View audit log for this host →
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-brand-ink">{children}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: typeof Star;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="num mt-0.5 inline-flex items-center gap-1 font-display text-lg font-bold text-brand-ink">
        {value}
        {Icon ? (
          <Icon className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        ) : null}
      </dd>
    </div>
  );
}
