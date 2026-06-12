import {
  Award,
  BadgeCheck,
  Languages,
  MessageSquare,
  Star,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getBrandName } from "@/lib/brand";
import { Link } from "@/i18n/navigation";

export async function HostCard({
  displayName,
  handle,
  bio,
  avatarUrl,
  isVerified,
  isSuperhost,
  responseRate,
  avgResponseHours,
  languages,
  hostingSince,
  rating,
  reviewCount,
  quoteButton,
}: {
  displayName: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isSuperhost: boolean;
  responseRate: number | null;
  avgResponseHours: number | null;
  languages: string[] | null;
  hostingSince: string | null;
  rating: number | null;
  reviewCount: number | null;
  // Rendered directly beneath the "View host profile" button so the quote CTA
  // sits with the host actions rather than detached below the whole card.
  quoteButton?: React.ReactNode;
}) {
  const [brandName, t] = await Promise.all([
    getBrandName(),
    getTranslations("listing"),
  ]);
  const initials = displayName.slice(0, 2).toUpperCase();
  const years = hostingYears(hostingSince);
  const hasRating = rating != null && (reviewCount ?? 0) > 0;
  const replyWindow =
    avgResponseHours == null
      ? null
      : avgResponseHours <= 1
        ? t("hostReplyHour")
        : avgResponseHours < 24
          ? t("hostReplyHours", { count: Math.round(avgResponseHours) })
          : t("hostReplyDays", { count: Math.round(avgResponseHours / 24) });

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Host card */}
      <div className="relative overflow-hidden rounded-card border border-brand-line bg-white lg:col-span-5">
        {isSuperhost ? (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2 py-0.5 text-[11px] font-semibold text-[#065F46]">
            <Award className="h-3 w-3" /> {t("heroSuperhost")}
          </div>
        ) : null}
        <div className="p-6">
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-full bg-brand-accent ring-4 ring-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-brand-primary">
                {initials}
              </div>
            )}
          </div>
          <div className="mt-3 text-center">
            <div className="font-display text-lg font-bold text-brand-ink">
              {displayName}
            </div>
            <div className="font-mono text-xs text-brand-mute">
              viloplatform.com/{handle}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-brand-line border-y border-brand-line py-3 text-center">
            <Stat
              value={reviewCount != null ? String(reviewCount) : "—"}
              label={t("hostStatReviews")}
            />
            <Stat
              value={hasRating ? (rating ?? 0).toFixed(2) : "—"}
              label={t("hostStatRating")}
            />
            <Stat
              value={years != null ? String(years) : "—"}
              label={t("hostStatYears")}
            />
          </div>
        </div>
      </div>

      {/* Host info */}
      <div className="lg:col-span-7">
        {bio ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-brand-ink/85">
            {bio}
          </p>
        ) : null}
        <div className="mt-5 space-y-3 text-sm text-brand-ink">
          {responseRate != null || avgResponseHours != null ? (
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-brand-mute" />
              {responseRate != null ? (
                <span>
                  {t("hostResponseRate", {
                    pct: Math.round(responseRate * 100),
                  })}
                </span>
              ) : null}
              {replyWindow != null ? (
                <span className="text-brand-mute">
                  · {t("hostUsuallyReplies", { window: replyWindow })}
                </span>
              ) : null}
            </div>
          ) : null}
          {languages && languages.length > 0 ? (
            <div className="flex items-center gap-3">
              <Languages className="h-4 w-4 text-brand-mute" />
              {t("hostSpeaks", { languages: languages.join(", ") })}
            </div>
          ) : null}
          {isVerified ? (
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-4 w-4 text-brand-primary" />
              {t("hostIdentityVerified", { brand: brandName })}
            </div>
          ) : null}
          {hasRating ? (
            <div className="flex items-center gap-3">
              <Star className="h-4 w-4 fill-amber-400 stroke-amber-400" />
              {t("hostRatingFrom", {
                rating: (rating ?? 0).toFixed(2),
                count: reviewCount ?? 0,
              })}
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex flex-col items-stretch gap-3 sm:max-w-xs">
          <Link
            href={`/${handle}`}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-brand-line px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-light"
          >
            {t("hostViewProfile")}
          </Link>
          {quoteButton ? (
            <div className="[&>*]:w-full [&>*]:justify-center">
              {quoteButton}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
    </div>
  );
}

function hostingYears(since: string | null): number | null {
  if (!since) return null;
  const start = new Date(since).getFullYear();
  if (Number.isNaN(start)) return null;
  return Math.max(0, new Date().getFullYear() - start);
}
