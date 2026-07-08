import { Link } from "@/i18n/navigation";
import { Search, User } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";

import { AdminTable, type AdminColumn } from "../_components/AdminTable";
import { AdminSegments } from "../_components/AdminSegments";
import { AdminStatBand } from "../_components/AdminStatBand";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at: string;
  deleted_at: string | null;
};

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; seg?: string };

const PAGE_SIZE = 50;
const SEGMENTS = ["all", "guest", "host", "staff", "suspended"] as const;

function isSeg(s: string | undefined): s is (typeof SEGMENTS)[number] {
  return SEGMENTS.includes((s ?? "") as (typeof SEGMENTS)[number]);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("users.view");

  const q = (searchParams?.q ?? "").trim();
  const seg: (typeof SEGMENTS)[number] = isSeg(searchParams?.seg)
    ? (searchParams!.seg as (typeof SEGMENTS)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("user_profiles")
    .select(
      "id, full_name, email, role, phone, is_active, created_at, deleted_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  if (seg === "guest") query = query.eq("role", "guest");
  else if (seg === "host") query = query.eq("role", "host");
  else if (seg === "staff") query = query.in("role", ["staff", "super_admin"]);
  else if (seg === "suspended") query = query.eq("is_active", false);

  const { data: rows, count } = await throwOnErrorWithCount(
    query,
    "admin/users",
  );

  const list = (rows as UserRow[] | null) ?? [];

  // Resolve each host's subscription plan for the Plan column — prefer the
  // product name (the catalog they're on), else the plan tier. Guests have none.
  const planByUser = new Map<string, string>();
  const listedIds = list.map((u) => u.id);
  if (listedIds.length > 0) {
    const { data: hostRows } = await service
      .from("hosts")
      .select("id, user_id")
      .in("user_id", listedIds)
      .is("deleted_at", null);
    const userByHost = new Map(
      (hostRows ?? []).map((h) => [h.id as string, h.user_id as string]),
    );
    const hostIds = (hostRows ?? []).map((h) => h.id as string);
    if (hostIds.length > 0) {
      const { data: subs } = await service
        .from("subscriptions")
        .select("host_id, plan, product_id")
        .in("host_id", hostIds);
      const productIds = [
        ...new Set(
          (subs ?? []).map((s) => s.product_id).filter(Boolean) as string[],
        ),
      ];
      const { data: products } = productIds.length
        ? await service.from("products").select("id, name").in("id", productIds)
        : { data: [] as { id: string; name: string }[] };
      const productName = new Map(
        (products ?? []).map((p) => [p.id as string, p.name as string]),
      );
      for (const s of subs ?? []) {
        const uid = userByHost.get(s.host_id as string);
        if (!uid) continue;
        const label =
          (s.product_id ? productName.get(s.product_id as string) : null) ??
          (s.plan
            ? (s.plan as string).charAt(0).toUpperCase() +
              (s.plan as string).slice(1)
            : "Free");
        planByUser.set(uid, label);
      }
    }
  }

  // KPI + segment counts (all non-deleted users).
  const { data: allRows } = await service
    .from("user_profiles")
    .select("role, is_active, created_at")
    .is("deleted_at", null);
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let total = 0;
  let hosts = 0;
  let guests = 0;
  let staff = 0;
  let suspended = 0;
  let new30 = 0;
  for (const u of allRows ?? []) {
    total += 1;
    if (u.role === "host") hosts += 1;
    else if (u.role === "guest") guests += 1;
    if (u.role === "staff" || u.role === "super_admin") staff += 1;
    if (u.is_active === false) suspended += 1;
    if (u.created_at && u.created_at >= since30) new30 += 1;
  }

  const columns: AdminColumn<UserRow>[] = [
    {
      header: "User",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-brand-ink">
                {u.full_name || "—"}
              </span>
              {!u.is_active ? (
                <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium text-status-cancelled">
                  Suspended
                </span>
              ) : null}
            </div>
            <div className="truncate font-mono text-[11px] text-brand-mute">
              {u.email}
            </div>
          </div>
        </div>
      ),
    },
    { header: "Role", cell: (u) => <RolePill role={u.role} /> },
    {
      header: "Plan",
      cell: (u) => {
        const plan = planByUser.get(u.id);
        if (plan) {
          return (
            <span className="inline-flex items-center rounded-pill border border-brand-primary/20 bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
              {plan}
            </span>
          );
        }
        return (
          <span className="text-[12px] text-brand-mute">
            {u.role === "host" ? "Free" : "—"}
          </span>
        );
      },
    },
    {
      header: "Joined",
      cell: (u) => (
        <span className="text-[12px] text-brand-mute">
          {new Date(u.created_at).toLocaleDateString("en-ZA")}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (u) => (
        <Link
          href={`/admin/users/${u.id}`}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
        >
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Users
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every account on the platform — guests, hosts, and staff.
        </p>
      </header>

      {/* KPI band — matches the overview's seamless stat tiles. */}
      <AdminStatBand
        cols={4}
        stats={[
          { label: "Total users", value: total, sub: `+${new30} in 30 days` },
          { label: "Hosts", value: hosts, href: "/admin/users?seg=host" },
          { label: "Guests", value: guests, href: "/admin/users?seg=guest" },
          {
            label: "Suspended",
            value: suspended,
            tone: suspended > 0 ? "amber" : "default",
            href: "/admin/users?seg=suspended",
          },
        ]}
      />

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(u) => u.id}
        empty="No users match this filter."
        topBar={
          <AdminSegments
            param="seg"
            current={seg}
            options={[
              { key: "all", label: "All", count: total },
              { key: "guest", label: "Guests", count: guests },
              { key: "host", label: "Hosts", count: hosts },
              { key: "staff", label: "Staff", count: staff },
              { key: "suspended", label: "Suspended", count: suspended },
            ]}
          />
        }
        toolbar={
          <form
            action="/admin/users"
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            {seg !== "all" ? (
              <input type="hidden" name="seg" value={seg} />
            ) : null}
            <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
              <Search className="h-4 w-4 text-brand-mute" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name or email…"
                className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
            >
              Search
            </button>
            {q ? (
              <Link
                href={
                  seg === "all" ? "/admin/users" : `/admin/users?seg=${seg}`
                }
                className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
        }
        footer={
          <div className="text-[12px] tabular-nums text-brand-mute">
            Showing {list.length} of {count ?? list.length}
            {count != null && count > PAGE_SIZE
              ? " — narrow your search to see more"
              : ""}
          </div>
        }
      />
    </div>
  );
}

function RolePill({ role }: { role: string | null }) {
  const styles: Record<string, string> = {
    admin: "bg-brand-primary/10 text-brand-primary border-brand-primary/30",
    host: "bg-brand-accent text-brand-primary border-brand-primary/20",
    guest: "bg-brand-light text-brand-mute border-brand-line",
  };
  const cls = styles[role ?? ""] ?? styles.guest;
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {role ?? "user"}
    </span>
  );
}
