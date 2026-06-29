"use client";

import {
  Armchair,
  Bath,
  BadgeCheck,
  Coffee,
  EarOff,
  Grape,
  HeartHandshake,
  MoonStar,
  Package,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import { ReviewPhotoGrid } from "@/components/reviews/ReviewPhotoGrid";

import type { ExternalReview, ReviewsData, TripType } from "./reviews-data";
import { voteReviewHelpfulAction } from "./reviews-actions";
import type { ReviewSource } from "@/lib/listings/aggregateRating";

const THEME_ICONS: Record<string, LucideIcon> = {
  grape: Grape,
  "heart-handshake": HeartHandshake,
  sparkles: Sparkles,
  "ear-off": EarOff,
  coffee: Coffee,
  "moon-star": MoonStar,
  bath: Bath,
  package: Package,
  armchair: Armchair,
};

const SOURCE_META: Record<
  ReviewSource,
  { label: string; color: string; bgColor: string }
> = {
  vilo: {
    label: "Wielo",
    color: "text-brand-primary",
    bgColor: "bg-brand-accent",
  },
  google: { label: "Google", color: "text-[#4285F4]", bgColor: "bg-blue-50" },
  facebook: {
    label: "Facebook",
    color: "text-[#1877F2]",
    bgColor: "bg-blue-50",
  },
  trustpilot: {
    label: "Trustpilot",
    color: "text-[#00B67A]",
    bgColor: "bg-green-50",
  },
};

function Stars({
  n,
  className = "h-4 w-4",
}: {
  n: number;
  className?: string;
}) {
  // Always render 5 stars, filled to the nearest whole star, so the visual
  // matches the numeric rating (e.g. 4.00 → 4 filled + 1 empty).
  const filled = Math.round(n);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${
            i <= filled
              ? "fill-amber-400 stroke-amber-400"
              : "fill-none stroke-brand-mute/40"
          }`}
        />
      ))}
    </span>
  );
}

function relMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    month: "short",
    year: "numeric",
  });
}

export function ReviewsSection({ data }: { data: ReviewsData }) {
  const brandName = useBrandName();
  const [tripFilter, setTripFilter] = useState<TripType | "all">("all");
  const [query, setQuery] = useState("");
  const [votes, setVotes] = useState<
    Record<string, { voted: boolean; delta: number }>
  >({});
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.reviews.filter((r) => {
      if (tripFilter !== "all" && r.tripType !== tripFilter) return false;
      if (q && !(r.body ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.reviews, tripFilter, query]);

  function helpful(id: string, current: number) {
    const prev = votes[id] ?? { voted: false, delta: 0 };
    // Optimistic toggle.
    const next = prev.voted
      ? { voted: false, delta: prev.delta - 1 }
      : { voted: true, delta: prev.delta + 1 };
    setVotes((v) => ({ ...v, [id]: next }));
    startTransition(async () => {
      const res = await voteReviewHelpfulAction(id);
      if (!res.ok) {
        setVotes((v) => ({ ...v, [id]: prev })); // revert
        toast.error(res.error);
      }
    });
    void current;
  }

  return (
    <section
      id="sec-reviews"
      className="border-b border-brand-line py-10 lg:py-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Reviews
          </div>
          <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink lg:text-3xl">
            What guests are saying
          </h3>
        </div>
      </div>

      {/* HERO STATS */}
      <div className="mt-6 grid items-center gap-8 rounded-card border border-brand-line bg-gradient-to-br from-brand-light to-white p-6 lg:grid-cols-12 lg:gap-10 lg:p-8">
        <div className="text-center lg:col-span-4 lg:text-left">
          <div className="flex items-baseline justify-center gap-2 lg:justify-start">
            <span className="font-display text-[68px] font-extrabold leading-none tracking-tight text-brand-ink lg:text-[80px]">
              {data.aggregated.overall.toFixed(2)}
            </span>
            <span className="font-display text-2xl text-brand-mute">/ 5</span>
          </div>
          <div className="mt-3">
            <Stars n={data.aggregated.overall} className="h-5 w-5" />
          </div>
          <div className="mt-2.5 text-sm text-brand-mute">
            From{" "}
            <span className="font-mono font-semibold text-brand-ink">
              {data.aggregated.totalCount}
            </span>{" "}
            review{data.aggregated.totalCount === 1 ? "" : "s"}
            {data.aggregated.sources.length > 1 ? (
              <span className="mt-1 block text-xs">
                {data.aggregated.sources.map((s, i) => (
                  <span key={s.source}>
                    {i > 0 && " · "}
                    <span className={SOURCE_META[s.source].color}>
                      {s.count} {s.label}
                    </span>
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        </div>

        {/* Distribution */}
        <div className="lg:col-span-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Rating breakdown
          </div>
          <div className="space-y-2">
            {data.distribution.map((d) => (
              <div key={d.star} className="flex items-center gap-3 text-xs">
                <span className="inline-flex w-6 items-center gap-0.5 font-medium text-brand-ink">
                  <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />
                  {d.star}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-brand-line/40">
                  {d.count > 0 ? (
                    <div
                      className="h-full rounded-pill bg-amber-400"
                      style={{
                        width: `${Math.max(6, (d.count / Math.max(1, data.count)) * 100)}%`,
                      }}
                    />
                  ) : null}
                </div>
                <span className="w-10 text-right font-mono text-brand-mute">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Guests mention */}
        {data.themes.length > 0 ? (
          <div className="lg:col-span-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Guests mention
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.themes.map((t) => {
                const Icon = THEME_ICONS[t.iconKey] ?? Sparkles;
                return (
                  <span
                    key={t.label}
                    className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand-secondary"
                  >
                    <Icon className="h-3 w-3" /> {t.label}
                    {t.count != null ? (
                      <span className="font-mono text-brand-mute">
                        {t.count}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* CATEGORY BARS */}
      {data.categories.length > 0 ? (
        <div className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((c) => (
            <div key={c.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-brand-ink">{c.label}</span>
                <span className="font-mono font-semibold text-brand-ink">
                  {c.avg.toFixed(1)}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-pill bg-brand-line">
                <div
                  className="h-full bg-brand-ink"
                  style={{ width: `${(c.avg / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* FILTERS + SEARCH */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div className="hscroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
          <FilterPill
            active={tripFilter === "all"}
            label="All"
            count={data.count}
            onClick={() => setTripFilter("all")}
          />
          {data.tripTypes.map((t) => (
            <FilterPill
              key={t.key}
              active={tripFilter === t.key}
              label={t.label}
              count={t.count}
              onClick={() => setTripFilter(t.key)}
            />
          ))}
        </div>
        <div className="relative w-full shrink-0 sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reviews…"
            className="w-full rounded-pill border border-brand-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15"
          />
        </div>
      </div>

      {/* FEATURED */}
      {data.featured && tripFilter === "all" && !query ? (
        <article className="mt-8 overflow-hidden rounded-card border border-brand-primary/25 bg-gradient-to-br from-brand-accent/40 via-white to-white p-6 lg:p-8">
          <div className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
            <Quote className="h-3 w-3" /> Featured review
          </div>
          <p className="mt-5 max-w-3xl text-balance font-display text-xl leading-[1.35] tracking-tight text-brand-ink lg:text-[26px]">
            “{data.featured.body}”
          </p>
          {data.featured.photos.length > 0 ? (
            <div className="mt-5">
              <ReviewPhotoGrid urls={data.featured.photos} />
            </div>
          ) : null}
          <div className="mt-6 flex items-center gap-3 border-t border-brand-primary/20 pt-5">
            <Avatar name={data.featured.guestName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="font-display font-bold text-brand-ink">
                  {data.featured.guestName}
                </div>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-primary">
                  <BadgeCheck className="h-3 w-3" /> Verified stay
                </span>
              </div>
              <div className="mt-0.5 text-xs text-brand-mute">
                {relMonth(data.featured.createdAt)}
                {data.featured.nights
                  ? ` · ${data.featured.nights} night${data.featured.nights === 1 ? "" : "s"}`
                  : ""}
              </div>
            </div>
            <div className="hidden shrink-0 sm:block">
              <Stars n={data.featured.rating} />
            </div>
          </div>
        </article>
      ) : null}

      {/* GRID */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:gap-5">
          {filtered.map((r) => {
            const v = votes[r.id];
            const count = r.helpfulCount + (v?.delta ?? 0);
            return (
              <article
                key={r.id}
                className="rounded-card border border-brand-line bg-white p-5 transition-shadow hover:shadow-lift lg:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.guestName} />
                    <div className="min-w-0">
                      <div className="font-display text-sm font-semibold leading-tight text-brand-ink">
                        {r.guestName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-brand-mute">
                        {relMonth(r.createdAt)}
                        {r.nights
                          ? ` · ${r.nights} night${r.nights === 1 ? "" : "s"}`
                          : ""}
                      </div>
                    </div>
                  </div>
                  {r.tripType ? (
                    <span className="shrink-0 rounded-pill border border-brand-line bg-brand-light px-2 py-[1px] text-[10.5px] font-semibold text-brand-secondary">
                      {tripLabel(r.tripType)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Stars n={r.rating} className="h-3.5 w-3.5" />
                </div>
                {r.body ? (
                  <p className="mt-3 text-[14.5px] leading-[1.65] text-brand-ink/85">
                    {r.body}
                  </p>
                ) : null}
                {r.photos.length > 0 ? (
                  <div className="mt-3">
                    <ReviewPhotoGrid urls={r.photos} />
                  </div>
                ) : null}
                {r.hostResponse ? (
                  <div className="mt-3 rounded-[10px] border border-brand-line bg-brand-light/50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                      Response from the host
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.6] text-brand-ink/85">
                      {r.hostResponse}
                    </p>
                  </div>
                ) : null}
                <div className="mt-5 flex items-center justify-between border-t border-brand-line pt-4 text-[11px] text-brand-mute">
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" />{" "}
                    Verified stay
                  </span>
                  <button
                    type="button"
                    onClick={() => helpful(r.id, count)}
                    className={`inline-flex items-center gap-1 hover:text-brand-ink ${
                      v?.voted ? "font-semibold text-brand-primary" : ""
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />{" "}
                    <span className="font-mono">{count}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
          No reviews match that filter.
        </div>
      )}

      {/* EXTERNAL REVIEWS */}
      {data.externalReviews.length > 0 ? (
        <div className="mt-10 border-t border-brand-line pt-8">
          <div className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Reviews from other platforms
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            {data.externalReviews.map((r) => (
              <ExternalReviewCard key={r.id} review={r} />
            ))}
          </div>
        </div>
      ) : null}

      {/* FOOTER TRUST */}
      <div className="mt-8 max-w-md text-xs leading-relaxed text-brand-mute">
        <ShieldCheck className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom text-brand-primary" />
        {brandName} only lets guests who completed a stay leave a review. Every
        score is from a verified booking.
      </div>
    </section>
  );
}

function ExternalReviewCard({ review }: { review: ExternalReview }) {
  const meta = SOURCE_META[review.source];
  return (
    <article className="rounded-card border border-brand-line bg-white p-5 transition-shadow hover:shadow-lift lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {review.reviewerAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.reviewerAvatar}
              alt={review.reviewerName}
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar name={review.reviewerName} />
          )}
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold leading-tight text-brand-ink">
              {review.reviewerName}
            </div>
            <div className="mt-0.5 text-[11px] text-brand-mute">
              {relMonth(review.createdAt)}
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-pill border border-brand-line px-2 py-[1px] text-[10.5px] font-semibold ${meta.bgColor} ${meta.color}`}
        >
          {meta.label}
        </span>
      </div>
      <div className="mt-3">
        <Stars n={review.rating} className="h-3.5 w-3.5" />
      </div>
      {review.body ? (
        <p className="mt-3 text-[14.5px] leading-[1.65] text-brand-ink/85">
          {review.body}
        </p>
      ) : null}
      {review.hostReply ? (
        <div className="mt-3 rounded-[10px] border border-brand-line bg-brand-light/50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Response from the host
          </div>
          <p className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.6] text-brand-ink/85">
            {review.hostReply}
          </p>
        </div>
      ) : null}
      <div className="mt-5 flex items-center justify-between border-t border-brand-line pt-4 text-[11px] text-brand-mute">
        <span className={`inline-flex items-center gap-1.5 ${meta.color}`}>
          {meta.label} review
        </span>
        {review.reviewUrl ? (
          <a
            href={review.reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-ink hover:underline"
          >
            View original
          </a>
        ) : null}
      </div>
    </article>
  );
}

function FilterPill({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-3 py-1 text-[12px] font-semibold transition-colors ${
        active
          ? "border-brand-ink bg-brand-ink text-white"
          : "border-brand-line bg-brand-light text-brand-secondary hover:bg-brand-accent"
      }`}
    >
      {label}
      <span
        className={`font-mono ${active ? "opacity-70" : "text-brand-mute"}`}
      >
        {count}
      </span>
    </button>
  );
}

const AVATAR_TINTS = [
  "bg-brand-secondary text-white",
  "bg-brand-primary text-brand-dark",
  "bg-brand-dark text-white",
  "bg-[#4A7C6A] text-white",
  "bg-[#6366F1] text-white",
];

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  let h = 0;
  for (let i = 0; i < initials.length; i++)
    h = (h * 31 + initials.charCodeAt(i)) >>> 0;
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${AVATAR_TINTS[h % AVATAR_TINTS.length]}`}
    >
      {initials}
    </div>
  );
}

function tripLabel(t: TripType): string {
  const m: Record<TripType, string> = {
    couples: "Couples",
    family: "Family",
    solo: "Solo",
    friends: "Friends",
    business: "Business",
    other: "Other",
  };
  return m[t];
}
