import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone, Shield } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";

import { SuspendDialog } from "./SuspendDialog";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("users.view");
  const service = createAdminClient();

  const { data: user } = await service
    .from("user_profiles")
    .select(
      "id, full_name, email, role, phone, avatar_url, is_active, created_at, updated_at, deleted_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!user) notFound();

  // Sidecar fetches in parallel.
  const [{ data: host }, { count: bookingsCount }, { count: refundsCount }] =
    await Promise.all([
      service
        .from("hosts")
        .select(
          "id, handle, display_name, is_verified, total_bookings, avg_rating, total_reviews, created_at",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      service
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("guest_id", user.id),
      service
        .from("refund_requests")
        .select("id", { count: "exact", head: true })
        .eq("guest_id", user.id),
    ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-brand-ink">
              {user.full_name || "—"}
            </h1>
            <RolePill role={user.role} />
            {!user.is_active ? (
              <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[11px] font-medium text-status-cancelled">
                Suspended
              </span>
            ) : null}
          </div>
          <div className="mt-1 font-mono text-xs text-brand-mute">
            {user.id}
          </div>
        </div>
        <SuspendDialog userId={user.id} isActive={user.is_active ?? true} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Contact
            </div>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row icon={Mail} label="Email" value={user.email} mono />
              <Row icon={Phone} label="Phone" value={user.phone} mono />
              <Row
                icon={Shield}
                label="Role"
                value={user.role ?? "—"}
                capitalise
              />
            </dl>
          </section>

          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Activity
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="Bookings (as guest)" value={bookingsCount ?? 0} />
              <Stat label="Refund requests" value={refundsCount ?? 0} />
              <Stat
                label="Joined"
                value={formatDateTime(user.created_at)?.split(",")[0] ?? "—"}
              />
            </dl>
          </section>

          {host ? (
            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Host profile
                </div>
                <Link
                  href={`/admin/hosts/${host.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  Open host page →
                </Link>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-base font-semibold text-brand-ink">
                    {host.display_name}
                  </div>
                  <div className="font-mono text-[11px] text-brand-mute">
                    @{host.handle}
                  </div>
                </div>
                <div className="text-right text-[12px]">
                  <div>
                    {host.is_verified ? (
                      <span className="inline-flex items-center rounded-pill bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                        Verified
                      </span>
                    ) : (
                      <span className="text-brand-mute">Unverified</span>
                    )}
                  </div>
                  <div className="mt-1 text-brand-mute">
                    {host.total_bookings} bookings ·{" "}
                    {Number(host.avg_rating ?? 0).toFixed(1)}★ ·{" "}
                    {host.total_reviews} reviews
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/${host.handle}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                >
                  Public page
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                  href={`/admin/as/${user.id}/dashboard`}
                  className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                >
                  View as host (read-only)
                </Link>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Account timestamps
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <TimelineLine label="Created" iso={user.created_at} />
              <TimelineLine label="Updated" iso={user.updated_at} />
              <TimelineLine label="Deleted" iso={user.deleted_at} />
            </dl>
          </section>

          <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              Audit
            </div>
            <p className="mt-2 text-[12.5px] text-brand-mute">
              All actions taken on this account are written to{" "}
              <Link
                href={`/admin/audit?target_type=user&target_id=${user.id}`}
                className="text-brand-primary underline-offset-2 hover:underline"
              >
                the audit log
              </Link>
              .
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono,
  capitalise,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  mono?: boolean;
  capitalise?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-brand-mute" />
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          {label}
        </dt>
        <dd
          className={`truncate font-medium text-brand-ink ${
            mono ? "font-mono text-xs" : ""
          } ${capitalise ? "capitalize" : ""}`}
        >
          {value ?? "—"}
        </dd>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="num mt-0.5 font-display text-lg font-bold text-brand-ink">
        {value}
      </dd>
    </div>
  );
}

function TimelineLine({ label, iso }: { label: string; iso: string | null }) {
  if (!iso) {
    return (
      <li className="flex items-center justify-between text-brand-mute">
        <span>{label}</span>
        <span>—</span>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between">
      <span className="font-medium text-brand-ink">{label}</span>
      <span className="font-mono text-xs text-brand-mute">
        {formatDateTime(iso)}
      </span>
    </li>
  );
}

function RolePill({ role }: { role: string | null }) {
  const styles: Record<string, string> = {
    super_admin:
      "bg-brand-primary/10 text-brand-primary border-brand-primary/30",
    admin: "bg-brand-primary/10 text-brand-primary border-brand-primary/30",
    staff: "bg-brand-primary/10 text-brand-primary border-brand-primary/30",
    host: "bg-brand-accent text-brand-primary border-brand-primary/20",
    guest: "bg-brand-light text-brand-mute border-brand-line",
  };
  const cls = styles[role ?? ""] ?? styles.guest;
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {(role ?? "guest").replace(/_/g, " ")}
    </span>
  );
}
