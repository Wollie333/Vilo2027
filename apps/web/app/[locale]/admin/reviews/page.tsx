import { Link } from "@/i18n/navigation";
import { Flag, Search, Star } from "lucide-react";

import { ReviewPhotoGrid } from "@/components/reviews/ReviewPhotoGrid";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";
import { reviewPhotoUrl } from "@/lib/reviews/photos";

import { ModerateButtons } from "./ModerateButtons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Mirrors the reason CHECK on review_flags / the host's FlagReviewDialog.
const FLAG_REASON_LABELS: Record<string, string> = {
  false_information: "Contains false information",
  personal_attack: "Personal attack",
  booking_never_occurred: "Guest never stayed",
  other: "Other",
};

type Tab = "flagged" | "all" | "pending";

type Filters = {
  tab: Tab;
  host: string; // host_id ("platform" filter)
  q: string; // guest name/email search ("user" filter)
  rating: string; // "" | "1".."5"
};

// `flags` is what the host actually wrote when they reported the review.
// reviews.flagged_reason only carries the enum ("other" tells a moderator
// nothing), so without this embed the host's explanation was written to
// review_flags and read by no one.
const SELECT = `
  id, host_id, rating, body, flagged, flagged_reason, is_published, admin_decision,
  created_at, publish_at,
  listing:properties!reviews_listing_id_fkey ( name ),
  host:hosts ( handle, display_name ),
  booking:bookings ( guest_name ),
  photos:review_photos ( storage_path, sort_order ),
  flags:review_flags ( reason, details, created_at )
`;

function buildQuery(service: ReturnType<typeof createAdminClient>, f: Filters) {
  // The guest embed becomes an inner join only when a guest search is active,
  // so we can filter parent rows by guest columns without dropping reviews that
  // have no linked account guest (manual bookings) the rest of the time.
  const guestEmbed = f.q
    ? "guest:user_profiles!reviews_guest_id_fkey!inner ( full_name, email )"
    : "guest:user_profiles!reviews_guest_id_fkey ( full_name, email )";

  let q = service
    .from("reviews")
    .select(`${SELECT}, ${guestEmbed}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  // Status tab.
  if (f.tab === "flagged") q = q.eq("flagged", true);
  else if (f.tab === "pending")
    q = q.is("is_published", false).eq("flagged", false);

  // "Platform" = host, and rating are plain column filters.
  if (f.host) q = q.eq("host_id", f.host);
  if (f.rating) q = q.eq("rating", Number(f.rating));

  // "User" = guest name/email. Strip chars that would break the or() parser.
  if (f.q) {
    const safe = f.q.replace(/[%,()]/g, " ").trim();
    if (safe)
      q = q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`, {
        referencedTable: "guest",
      });
  }
  return q;
}

/** Build a /admin/reviews href that preserves the current filters. */
function hrefWith(f: Filters, override: Partial<Filters>): string {
  const merged = { ...f, ...override };
  const sp = new URLSearchParams();
  if (merged.tab !== "flagged") sp.set("tab", merged.tab);
  if (merged.host) sp.set("host", merged.host);
  if (merged.q) sp.set("q", merged.q);
  if (merged.rating) sp.set("rating", merged.rating);
  const s = sp.toString();
  return s ? `/admin/reviews?${s}` : "/admin/reviews";
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: {
    tab?: string;
    host?: string;
    q?: string;
    rating?: string;
  };
}) {
  await requirePermission("reviews.moderate");

  const tabParam = (searchParams?.tab ?? "flagged").trim();
  const f: Filters = {
    tab: (["flagged", "all", "pending"].includes(tabParam)
      ? tabParam
      : "flagged") as Tab,
    host: (searchParams?.host ?? "").trim(),
    q: (searchParams?.q ?? "").trim(),
    rating: ["1", "2", "3", "4", "5"].includes(searchParams?.rating ?? "")
      ? (searchParams?.rating as string)
      : "",
  };

  const service = createAdminClient();

  const [
    { count: flaggedCount },
    { count: pendingCount },
    { count: allCount },
    { data: hostRows },
  ] = await Promise.all([
    service
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("flagged", true),
    service
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .is("is_published", false)
      .eq("flagged", false),
    service.from("reviews").select("id", { count: "exact", head: true }),
    service
      .from("hosts")
      .select("id, display_name")
      .is("deleted_at", null)
      .order("display_name", { ascending: true })
      .limit(1000),
  ]);

  const { data: rows, count } = await throwOnErrorWithCount(
    buildQuery(service, f),
    "admin/reviews",
  );

  const hosts =
    (hostRows as { id: string; display_name: string }[] | null) ?? [];

  type Row = {
    id: string;
    host_id: string;
    rating: number;
    body: string | null;
    flagged: boolean;
    flagged_reason: string | null;
    is_published: boolean;
    admin_decision: string | null;
    created_at: string;
    publish_at: string | null;
    listing: { name: string } | { name: string }[] | null;
    host:
      | { handle: string; display_name: string }
      | { handle: string; display_name: string }[]
      | null;
    guest:
      | { full_name: string | null; email: string | null }
      | { full_name: string | null; email: string | null }[]
      | null;
    booking:
      | { guest_name: string | null }
      | { guest_name: string | null }[]
      | null;
    photos: { storage_path: string; sort_order: number }[] | null;
    flags:
      | { reason: string; details: string | null; created_at: string }[]
      | null;
  };

  const list = (rows as Row[] | null) ?? [];
  const hasFilters = Boolean(f.host || f.q || f.rating);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Reviews
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every review across the platform. Filter by host or guest, and step in
          on flags — hosts respond to their own reviews.
        </p>
      </header>

      {/* Status tabs (counts are platform-wide) */}
      <section className="flex flex-wrap items-center gap-2">
        <TabLink f={f} tab="flagged" count={flaggedCount ?? 0}>
          Flagged
        </TabLink>
        <TabLink f={f} tab="pending" count={pendingCount ?? 0}>
          Pending publish
        </TabLink>
        <TabLink f={f} tab="all" count={allCount ?? 0}>
          All
        </TabLink>
      </section>

      {/* Filter toolbar — GET form preserves the active tab via a hidden field */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-card border border-brand-line bg-white p-4 shadow-card"
      >
        {f.tab !== "flagged" ? (
          <input type="hidden" name="tab" value={f.tab} />
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Host (platform)
          </span>
          <select
            name="host"
            defaultValue={f.host}
            className="h-9 min-w-[180px] rounded-md border border-brand-line bg-white px-2.5 text-[13px] text-brand-ink"
          >
            <option value="">All hosts</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Guest (user)
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-mute" />
            <input
              type="search"
              name="q"
              defaultValue={f.q}
              placeholder="Name or email"
              className="h-9 w-[200px] rounded-md border border-brand-line bg-white pl-8 pr-2.5 text-[13px] text-brand-ink"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Rating
          </span>
          <select
            name="rating"
            defaultValue={f.rating}
            className="h-9 rounded-md border border-brand-line bg-white px-2.5 text-[13px] text-brand-ink"
          >
            <option value="">Any</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={String(n)}>
                {n} stars
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link
            href={hrefWith(f, { host: "", q: "", rating: "" })}
            className="h-9 rounded-pill border border-brand-line bg-white px-4 text-[13px] font-medium leading-9 text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <p className="font-display text-base font-bold text-brand-ink">
              {f.tab === "flagged" && !hasFilters
                ? "No flagged reviews — nice and quiet"
                : "No reviews match these filters"}
            </p>
          </div>
        ) : (
          list.map((r) => {
            const listing = Array.isArray(r.listing) ? r.listing[0] : r.listing;
            const host = Array.isArray(r.host) ? r.host[0] : r.host;
            const guest = Array.isArray(r.guest) ? r.guest[0] : r.guest;
            const rbooking = Array.isArray(r.booking)
              ? r.booking[0]
              : r.booking;
            return (
              <article
                key={r.id}
                className="rounded-card border border-brand-line bg-white p-5 shadow-card"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${
                              n <= r.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-brand-mute/40"
                            }`}
                          />
                        ))}
                      </div>
                      {r.flagged ? (
                        <span className="inline-flex items-center gap-1 rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[11px] font-medium text-status-cancelled">
                          <Flag className="h-3 w-3" />
                          Flagged
                        </span>
                      ) : !r.is_published ? (
                        <span className="inline-flex items-center rounded-pill border border-status-pending/30 bg-status-pending/10 px-2 py-0.5 text-[11px] font-medium text-status-pending">
                          Awaiting publish
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-pill border border-status-confirmed/30 bg-status-confirmed/10 px-2 py-0.5 text-[11px] font-medium text-status-confirmed">
                          Live
                        </span>
                      )}
                      {r.admin_decision ? (
                        <span className="inline-flex items-center rounded-pill border border-brand-primary/30 bg-brand-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-primary">
                          Admin: {r.admin_decision}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[12px] text-brand-mute">
                      <span className="font-medium text-brand-ink">
                        {guest?.full_name ??
                          rbooking?.guest_name ??
                          "Anonymous"}
                      </span>
                      {" → "}
                      <span className="font-medium text-brand-ink">
                        {listing?.name ?? "Listing"}
                      </span>
                      {host ? (
                        <>
                          {" · "}
                          <Link
                            href={hrefWith(f, {
                              host: r.host_id,
                              tab: "all",
                            })}
                            className="text-brand-primary hover:underline"
                            title="Filter to this host"
                          >
                            {host.display_name}
                          </Link>
                        </>
                      ) : null}
                      {" · "}
                      {new Date(r.created_at).toLocaleDateString("en-ZA")}
                    </div>
                  </div>
                  <ModerateButtons reviewId={r.id} hidden={r.flagged} />
                </header>

                {r.body ? (
                  <p className="mt-3 text-[14px] leading-relaxed text-brand-ink">
                    “{r.body}”
                  </p>
                ) : (
                  <p className="mt-3 text-[13px] italic text-brand-mute">
                    Rating only — no written review.
                  </p>
                )}

                {r.photos && r.photos.length > 0 ? (
                  <div className="mt-3">
                    <ReviewPhotoGrid
                      urls={r.photos
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((p) => reviewPhotoUrl(p.storage_path))}
                      size="sm"
                    />
                  </div>
                ) : null}

                {r.flagged_reason ? (
                  <div className="mt-3 rounded border border-status-cancelled/30 bg-status-cancelled/5 px-3 py-2 text-[12.5px] text-brand-dark">
                    <span className="text-brand-mute">Flag reason:</span>{" "}
                    {FLAG_REASON_LABELS[r.flagged_reason] ?? r.flagged_reason}
                    {/* What the host actually wrote — the reason enum alone
                        isn't enough to judge a dispute on. */}
                    {(r.flags ?? []).map((f, i) =>
                      f.details ? (
                        <p
                          key={i}
                          className="mt-1.5 border-t border-status-cancelled/20 pt-1.5 text-brand-dark"
                        >
                          <span className="text-brand-mute">Host said:</span>{" "}
                          &ldquo;{f.details}&rdquo;
                        </p>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {count != null && count > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {count}.
        </p>
      ) : null}
    </div>
  );
}

function TabLink({
  f,
  tab,
  count,
  children,
}: {
  f: Filters;
  tab: Tab;
  count: number;
  children: React.ReactNode;
}) {
  const active = tab === f.tab;
  return (
    <Link
      href={hrefWith(f, { tab })}
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
