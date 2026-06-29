import { Link } from "@/i18n/navigation";
import { Download, ShieldAlert, Trash2 } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnError } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";

import { RequestActions } from "./RequestActions";

export const dynamic = "force-dynamic";

type Tab = "pending" | "processing" | "completed" | "all";

const TAB_FILTERS: Record<Tab, string[] | null> = {
  pending: ["pending"],
  processing: ["processing"],
  completed: ["completed", "rejected", "cancelled"],
  all: null,
};

export default async function AdminDataRequestsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  // PII queue — gate on user-data permission, not mere staff membership.
  await requirePermission("users.view");

  const tabParam = (searchParams?.tab ?? "pending").trim();
  const tab: Tab = (
    ["pending", "processing", "completed", "all"].includes(tabParam)
      ? tabParam
      : "pending"
  ) as Tab;

  const service = createAdminClient();

  const [
    { count: pendingCount },
    { count: processingCount },
    { count: completedCount },
    { count: allCount },
  ] = await Promise.all([
    service
      .from("data_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("data_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
    service
      .from("data_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["completed", "rejected", "cancelled"]),
    service.from("data_requests").select("id", { count: "exact", head: true }),
  ]);

  let query = service
    .from("data_requests")
    .select(
      `
      id, request_type, status, notes, rejected_reason,
      created_at, fulfilled_at,
      user:user_profiles!data_requests_user_id_fkey ( id, full_name, email )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (TAB_FILTERS[tab]) query = query.in("status", TAB_FILTERS[tab]!);

  const rows = await throwOnError(query, "admin/data-requests");

  type Row = {
    id: string;
    request_type: "export" | "deletion";
    status: string;
    notes: string | null;
    rejected_reason: string | null;
    created_at: string;
    fulfilled_at: string | null;
    user:
      | { id: string; full_name: string | null; email: string | null }
      | { id: string; full_name: string | null; email: string | null }[]
      | null;
  };

  const list = (rows as Row[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Data subject requests
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          POPIA / GDPR access + erasure requests. Each is logged for the 30-day
          fulfilment window.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <TabLink tab="pending" current={tab} count={pendingCount ?? 0}>
          Pending
        </TabLink>
        <TabLink tab="processing" current={tab} count={processingCount ?? 0}>
          Processing
        </TabLink>
        <TabLink tab="completed" current={tab} count={completedCount ?? 0}>
          Completed
        </TabLink>
        <TabLink tab="all" current={tab} count={allCount ?? 0}>
          All
        </TabLink>
      </section>

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <ShieldAlert className="mx-auto mb-3 h-6 w-6 text-brand-primary" />
            <p className="font-display text-base font-bold text-brand-ink">
              {tab === "pending"
                ? "No pending data requests"
                : "No requests match this tab"}
            </p>
          </div>
        ) : (
          list.map((r) => {
            const user = Array.isArray(r.user) ? r.user[0] : r.user;
            const isExport = r.request_type === "export";
            return (
              <article
                key={r.id}
                className={`rounded-card border bg-white p-5 shadow-card ${
                  isExport ? "border-brand-line" : "border-status-cancelled/30"
                }`}
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded ${
                          isExport
                            ? "bg-brand-accent text-brand-primary"
                            : "bg-status-cancelled/15 text-status-cancelled"
                        }`}
                      >
                        {isExport ? (
                          <Download className="h-3.5 w-3.5" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span className="font-display text-base font-semibold capitalize text-brand-ink">
                        {r.request_type}
                      </span>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-2 text-[13px] text-brand-mute">
                      {user?.full_name ?? "—"}{" "}
                      <span className="font-mono text-[11px]">
                        {user?.email ?? ""}
                      </span>
                      {user ? (
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="ml-2 text-[11px] text-brand-primary underline-offset-2 hover:underline"
                        >
                          open user
                        </Link>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-brand-mute">
                      Requested{" "}
                      {new Date(r.created_at).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {r.fulfilled_at
                        ? ` · fulfilled ${new Date(
                            r.fulfilled_at,
                          ).toLocaleDateString("en-ZA")}`
                        : ""}
                    </div>
                  </div>
                  {r.status === "pending" || r.status === "processing" ? (
                    <RequestActions
                      requestId={r.id}
                      requestType={r.request_type}
                      status={r.status}
                    />
                  ) : null}
                </header>

                {r.notes ? (
                  <div className="mt-3 rounded border border-brand-line bg-brand-light/40 p-3 text-[12.5px] text-brand-dark">
                    <span className="text-brand-mute">User note:</span>{" "}
                    {r.notes}
                  </div>
                ) : null}

                {r.rejected_reason ? (
                  <div className="mt-3 rounded border border-status-cancelled/30 bg-status-cancelled/5 p-3 text-[12.5px] text-brand-dark">
                    <span className="text-brand-mute">Rejected:</span>{" "}
                    {r.rejected_reason}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function TabLink({
  tab,
  current,
  count,
  children,
}: {
  tab: Tab;
  current: Tab;
  count: number;
  children: React.ReactNode;
}) {
  const active = tab === current;
  return (
    <Link
      href={
        tab === "pending"
          ? "/admin/data-requests"
          : `/admin/data-requests?tab=${tab}`
      }
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-brand-primary text-white shadow-sm"
          : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      {children}
      <span
        className={`num rounded-pill px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? "bg-white/25 text-white" : "bg-brand-light text-brand-mute"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
    processing: "bg-brand-accent text-brand-primary border-brand-primary/20",
    completed:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    rejected:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
    cancelled: "bg-brand-light text-brand-mute border-brand-line",
  };
  const cls = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}
