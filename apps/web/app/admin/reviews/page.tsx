import Link from "next/link";
import { Flag, Star } from "lucide-react";

import { ReviewPhotoGrid } from "@/components/reviews/ReviewPhotoGrid";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";
import { reviewPhotoUrl } from "@/lib/reviews/photos";

import { ModerateButtons } from "./ModerateButtons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Tab = "flagged" | "all" | "pending";

const TAB_FILTERS: Record<
  Tab,
  (q: ReturnType<typeof base>) => ReturnType<typeof base>
> = {
  flagged: (q) => q.eq("flagged", true),
  all: (q) => q,
  pending: (q) => q.is("is_published", false).eq("flagged", false),
};

function base(service: ReturnType<typeof createAdminClient>) {
  return service
    .from("reviews")
    .select(
      `
      id, rating, body, flagged, flagged_reason, is_published, admin_decision,
      created_at, publish_at,
      listing:listings!reviews_listing_id_fkey ( name ),
      host:hosts ( handle, display_name ),
      guest:user_profiles!reviews_guest_id_fkey ( full_name, email ),
      booking:bookings ( guest_name ),
      photos:review_photos ( storage_path, sort_order )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  await requirePermission("reviews.moderate");

  const tabParam = (searchParams?.tab ?? "flagged").trim();
  const tab: Tab = (
    ["flagged", "all", "pending"].includes(tabParam) ? tabParam : "flagged"
  ) as Tab;

  const service = createAdminClient();

  const [
    { count: flaggedCount },
    { count: pendingCount },
    { count: allCount },
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
  ]);

  const { data: rows, count } = await TAB_FILTERS[tab](base(service));

  type Row = {
    id: string;
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
  };

  const list = (rows as Row[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Reviews moderation
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Flagged reviews, pending publication queue. Hosts respond to their own
          reviews; admin only steps in for flags.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <TabLink tab="flagged" current={tab} count={flaggedCount ?? 0}>
          Flagged
        </TabLink>
        <TabLink tab="pending" current={tab} count={pendingCount ?? 0}>
          Pending publish
        </TabLink>
        <TabLink tab="all" current={tab} count={allCount ?? 0}>
          All
        </TabLink>
      </section>

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <p className="font-display text-base font-bold text-brand-ink">
              {tab === "flagged"
                ? "No flagged reviews — nice and quiet"
                : "No reviews match this tab"}
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
                            href={`/admin/hosts/${(host as { handle: string }).handle ? `${(host as { handle: string }).handle}` : ""}`}
                            className="text-brand-primary hover:underline"
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
                    {r.flagged_reason}
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
      href={tab === "flagged" ? "/admin/reviews" : `/admin/reviews?tab=${tab}`}
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
