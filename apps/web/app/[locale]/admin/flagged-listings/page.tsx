import { Link } from "@/i18n/navigation";
import { ExternalLink, Flag } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import {
  REPORT_TARGET_META,
  type ReportTargetType,
} from "@/lib/report/report-constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnError } from "@/lib/supabase/query";

import { ReportActions } from "./ReportActions";

export const dynamic = "force-dynamic";

type Tab = "open" | "reviewing" | "resolved" | "all";
type Category = "all" | ReportTargetType;

const TAB_FILTERS: Record<Tab, string[] | null> = {
  open: ["open"],
  reviewing: ["reviewing"],
  resolved: ["actioned", "dismissed"],
  all: null,
};

const REASON_LABEL: Record<string, string> = {
  scam: "Scam or fraud",
  not_real: "Fake or misleading",
  inappropriate: "Inappropriate content",
  safety: "Safety concern",
  spam: "Spam or duplicate",
  other: "Something else",
};

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "listing", label: "Listings" },
  { key: "deal", label: "Deals" },
  { key: "user", label: "Users" },
];

export default async function AdminFlaggedContentPage({
  searchParams,
}: {
  searchParams?: { tab?: string; category?: string };
}) {
  await requirePermission("listings.moderate");

  const tabParam = (searchParams?.tab ?? "open").trim();
  const tab: Tab = (
    ["open", "reviewing", "resolved", "all"].includes(tabParam)
      ? tabParam
      : "open"
  ) as Tab;

  const catParam = (searchParams?.category ?? "all").trim();
  const category: Category = (
    ["all", "listing", "deal", "user"].includes(catParam) ? catParam : "all"
  ) as Category;

  const service = createAdminClient();

  // Status counts respect the active category so the tab badges match the view.
  const statusCount = (status: string[] | null) => {
    let q = service
      .from("listing_reports")
      .select("id", { count: "exact", head: true });
    if (status) q = q.in("status", status);
    if (category !== "all") q = q.eq("target_type", category);
    return q;
  };
  // Category counts respect the active status tab.
  const catCount = (cat: Category) => {
    let q = service
      .from("listing_reports")
      .select("id", { count: "exact", head: true });
    if (TAB_FILTERS[tab]) q = q.in("status", TAB_FILTERS[tab]!);
    if (cat !== "all") q = q.eq("target_type", cat);
    return q;
  };

  const [
    { count: openCount },
    { count: reviewingCount },
    { count: resolvedCount },
    { count: allCount },
    { count: catAll },
    { count: catListing },
    { count: catDeal },
    { count: catUser },
  ] = await Promise.all([
    statusCount(["open"]),
    statusCount(["reviewing"]),
    statusCount(["actioned", "dismissed"]),
    statusCount(null),
    catCount("all"),
    catCount("listing"),
    catCount("deal"),
    catCount("user"),
  ]);
  const catCounts: Record<Category, number> = {
    all: catAll ?? 0,
    listing: catListing ?? 0,
    deal: catDeal ?? 0,
    user: catUser ?? 0,
  };

  let query = service
    .from("listing_reports")
    .select(
      `id, target_type, target_id, target_label, property_id, listing_name,
       reason, message, status, admin_note,
       reporter_name, reporter_email, reporter_phone, created_at, reviewed_at,
       property:properties!listing_reports_property_id_fkey ( slug )`,
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (TAB_FILTERS[tab]) query = query.in("status", TAB_FILTERS[tab]!);
  if (category !== "all") query = query.eq("target_type", category);

  const rows = await throwOnError(query, "admin/flagged-listings");

  type Row = {
    id: string;
    target_type: ReportTargetType;
    target_id: string;
    target_label: string | null;
    property_id: string | null;
    listing_name: string | null;
    reason: string;
    message: string;
    status: string;
    admin_note: string | null;
    reporter_name: string;
    reporter_email: string;
    reporter_phone: string | null;
    created_at: string;
    reviewed_at: string | null;
    property: { slug: string | null } | { slug: string | null }[] | null;
  };

  const list = (rows as Row[] | null) ?? [];

  const buildHref = (t: Tab, c: Category) => {
    const params = new URLSearchParams();
    if (t !== "open") params.set("tab", t);
    if (c !== "all") params.set("category", c);
    const qs = params.toString();
    return qs ? `/admin/flagged-listings?${qs}` : "/admin/flagged-listings";
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Flagged content
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Reports of listings, deals and users that may break the rules. Review
          each and mark it actioned or dismissed.
        </p>
      </header>

      {/* Category filter */}
      <section className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <CategoryLink
            key={c.key}
            href={buildHref(tab, c.key)}
            active={category === c.key}
            count={catCounts[c.key]}
          >
            {c.label}
          </CategoryLink>
        ))}
      </section>

      {/* Status filter */}
      <section className="flex flex-wrap items-center gap-2">
        <TabLink
          href={buildHref("open", category)}
          active={tab === "open"}
          count={openCount ?? 0}
        >
          Open
        </TabLink>
        <TabLink
          href={buildHref("reviewing", category)}
          active={tab === "reviewing"}
          count={reviewingCount ?? 0}
        >
          Reviewing
        </TabLink>
        <TabLink
          href={buildHref("resolved", category)}
          active={tab === "resolved"}
          count={resolvedCount ?? 0}
        >
          Resolved
        </TabLink>
        <TabLink
          href={buildHref("all", category)}
          active={tab === "all"}
          count={allCount ?? 0}
        >
          All
        </TabLink>
      </section>

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <Flag className="mx-auto mb-3 h-6 w-6 text-brand-primary" />
            <p className="font-display text-base font-bold text-brand-ink">
              {tab === "open"
                ? "No open reports — all clear"
                : "No reports match this filter"}
            </p>
          </div>
        ) : (
          list.map((r) => {
            const prop = Array.isArray(r.property) ? r.property[0] : r.property;
            const isResolved =
              r.status === "actioned" || r.status === "dismissed";
            const label = r.target_label ?? r.listing_name ?? "Item";
            return (
              <article
                key={r.id}
                className={`rounded-card border bg-white p-5 shadow-card ${
                  isResolved ? "border-brand-line" : "border-status-pending/30"
                }`}
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-pill bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                        {REPORT_TARGET_META[r.target_type]?.adminLabel ??
                          r.target_type}
                      </span>
                      <span className="rounded-pill bg-status-cancelled/10 px-2 py-0.5 text-[11px] font-semibold text-status-cancelled">
                        {REASON_LABEL[r.reason] ?? r.reason}
                      </span>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-2 font-display text-base font-semibold text-brand-ink">
                      {label}
                      {r.target_type === "listing" && prop?.slug ? (
                        <a
                          href={`/property/${prop.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-primary underline-offset-2 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> open listing
                        </a>
                      ) : null}
                      {r.target_type === "listing" && r.property_id ? (
                        <Link
                          href={`/admin/properties/${r.property_id}`}
                          className="ml-2 text-[11px] text-brand-primary underline-offset-2 hover:underline"
                        >
                          admin view
                        </Link>
                      ) : null}
                      {r.target_type === "user" ? (
                        <Link
                          href={`/admin/users/${r.target_id}`}
                          className="ml-2 text-[11px] text-brand-primary underline-offset-2 hover:underline"
                        >
                          admin view
                        </Link>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[12.5px] text-brand-mute">
                      Reported by{" "}
                      <span className="text-brand-ink">{r.reporter_name}</span>{" "}
                      <span className="font-mono text-[11px]">
                        {r.reporter_email}
                      </span>
                      {r.reporter_phone ? (
                        <span className="font-mono text-[11px]">
                          {" · "}
                          {r.reporter_phone}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-brand-mute">
                      {new Date(r.created_at).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {r.reviewed_at
                        ? ` · resolved ${new Date(
                            r.reviewed_at,
                          ).toLocaleDateString("en-ZA")}`
                        : ""}
                    </div>
                  </div>
                  {!isResolved ? (
                    <ReportActions reportId={r.id} status={r.status} />
                  ) : null}
                </header>

                <div className="mt-3 rounded border border-brand-line bg-brand-light/40 p-3 text-[12.5px] text-brand-dark">
                  <span className="text-brand-mute">Report:</span> {r.message}
                </div>

                {r.admin_note ? (
                  <div className="mt-2 rounded border border-brand-line bg-white p-3 text-[12.5px] text-brand-dark">
                    <span className="text-brand-mute">Admin note:</span>{" "}
                    {r.admin_note}
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
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
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

function CategoryLink({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
          : "border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      {children}
      <span className="num text-[10px] opacity-70">{count}</span>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-status-pending/10 text-status-pending border-status-pending/30",
    reviewing: "bg-brand-accent text-brand-primary border-brand-primary/20",
    actioned:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    dismissed: "bg-brand-light text-brand-mute border-brand-line",
  };
  const cls = map[status] ?? map.open;
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}
