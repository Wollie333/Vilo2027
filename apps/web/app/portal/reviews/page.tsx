import type { Metadata } from "next";
import { ArrowRight, Star, StarHalf } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reviews · Vilo",
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalReviewsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Bookings that are completed (i.e. stay is done) — eligible for a review.
  const { data: completedRows } = await supabase
    .from("bookings")
    .select(
      `
      id, reference, check_in, check_out, session_date, status,
      listing:listings ( name )
    `,
    )
    .eq("guest_id", user.id)
    .is("deleted_at", null)
    .in("status", ["completed"])
    .order("check_out", { ascending: false })
    .limit(50);

  // Reviews the guest has already submitted (used to filter out done ones).
  const { data: writtenRows } = await supabase
    .from("reviews")
    .select("booking_id, rating, content, created_at")
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false });

  type CompletedRow = {
    id: string;
    reference: string;
    check_in: string | null;
    check_out: string | null;
    session_date: string | null;
    status: string;
    listing: { name: string } | { name: string }[] | null;
  };
  type ReviewRow = {
    booking_id: string;
    rating: number;
    content: string | null;
    created_at: string;
  };

  const completed = (completedRows as CompletedRow[] | null) ?? [];
  const written = (writtenRows as ReviewRow[] | null) ?? [];
  const writtenIds = new Set(written.map((r) => r.booking_id));
  const pending = completed.filter((b) => !writtenIds.has(b.id));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Reviews
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Help future guests by sharing what your stay was actually like.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
          To write{" "}
          <span className="font-mono text-brand-mute">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-6 text-center text-sm text-brand-mute">
            All caught up — no completed stays awaiting a review.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((b) => {
              const listing = Array.isArray(b.listing)
                ? b.listing[0]
                : b.listing;
              return (
                <li
                  key={b.id}
                  className="rounded-card border border-brand-line bg-white p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-base font-semibold text-brand-ink">
                        {listing?.name ?? "Stay"}
                      </div>
                      <div className="mt-1 text-xs text-brand-mute">
                        {b.session_date
                          ? fmtDate(b.session_date)
                          : `${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}`}
                        {" · "}
                        <span className="font-mono">{b.reference}</span>
                      </div>
                    </div>
                    <Link
                      href={`/review/${b.id}`}
                      className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
                    >
                      Write review <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
          Your reviews{" "}
          <span className="font-mono text-brand-mute">({written.length})</span>
        </h2>
        {written.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-6 text-center text-sm text-brand-mute">
            You haven&apos;t left any reviews yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {written.map((r) => (
              <li
                key={r.booking_id}
                className="rounded-card border border-brand-line bg-white p-5 shadow-card"
              >
                <div className="flex items-center gap-1 text-amber-500">
                  {[1, 2, 3, 4, 5].map((i) =>
                    i <= Math.floor(r.rating) ? (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ) : i - 0.5 <= r.rating ? (
                      <StarHalf key={i} className="h-4 w-4 fill-current" />
                    ) : (
                      <Star key={i} className="h-4 w-4 text-brand-line" />
                    ),
                  )}
                  <span className="ml-2 font-mono text-xs text-brand-mute">
                    {r.rating.toFixed(1)}
                  </span>
                </div>
                {r.content ? (
                  <p className="mt-2 text-sm leading-relaxed text-brand-dark">
                    {r.content}
                  </p>
                ) : null}
                <div className="mt-2 text-[11px] text-brand-mute">
                  Posted {fmtDate(r.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
