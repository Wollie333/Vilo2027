import { BadgeCheck, Check, Star } from "lucide-react";

/**
 * Standard "Verified host" trust card shown above Share/Save in the title row.
 * Fixed layout (no host customisation) — fed entirely by live host data.
 */
export function TrustCard({
  hostName,
  avatarUrl,
  isVerified,
  avgResponseHours,
  hostingSince,
  rating,
  reviewCount,
}: {
  hostName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  avgResponseHours: number | null;
  hostingSince: string | null;
  rating: number | null;
  reviewCount: number | null;
}) {
  const replyLine = responseLine(avgResponseHours);
  const yearsLine = hostingYears(hostingSince);
  const sub = [replyLine, yearsLine].filter(Boolean).join(" · ");

  return (
    <div className="w-full rounded-card border border-brand-line bg-white p-3.5 shadow-card md:w-[360px]">
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-accent font-display text-sm font-bold text-brand-secondary ring-2 ring-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={hostName}
                className="h-full w-full object-cover"
              />
            ) : (
              hostName.slice(0, 2).toUpperCase()
            )}
          </div>
          {isVerified ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
              <Check className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate font-display text-sm font-semibold leading-tight text-brand-ink">
              {hostName}
            </div>
            {isVerified ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-pill bg-brand-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-secondary">
                <BadgeCheck className="h-2.5 w-2.5" /> Verified
              </span>
            ) : null}
          </div>
          {sub ? (
            <div className="mt-0.5 truncate text-[11px] text-brand-mute">
              {sub}
            </div>
          ) : null}
        </div>

        {rating != null && (reviewCount ?? 0) > 0 ? (
          <div className="shrink-0 border-l border-brand-line pl-3 text-right">
            <div className="inline-flex items-center gap-0.5 text-sm leading-none">
              <Star className="h-3.5 w-3.5 fill-brand-ink stroke-brand-ink" />
              <span className="font-semibold text-brand-ink">
                {rating.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-brand-mute">
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function responseLine(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours <= 1) return "Replies in ~1h";
  if (hours < 24) return `Replies in ~${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `Replies in ~${days} day${days === 1 ? "" : "s"}`;
}

function hostingYears(since: string | null): string | null {
  if (!since) return null;
  const start = new Date(since).getFullYear();
  if (Number.isNaN(start)) return null;
  const years = new Date().getFullYear() - start;
  if (years <= 0) return "New host";
  return `${years} yr${years === 1 ? "" : "s"} hosting`;
}
