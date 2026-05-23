import { BadgeCheck, MessageSquare } from "lucide-react";

export function HostCard({
  displayName,
  handle,
  bio,
  avatarUrl,
  isVerified,
}: {
  displayName: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}) {
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <div className="rounded-card border border-brand-line bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent font-display text-base font-bold text-brand-primary">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-display text-lg font-semibold text-brand-ink">
              {displayName}
            </div>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified host
              </span>
            ) : null}
          </div>
          <div className="font-mono text-xs text-brand-mute">
            viloplatform.com/{handle}
          </div>
        </div>
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent sm:inline-flex"
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </button>
      </div>
      {bio ? (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-brand-dark">
          {bio}
        </p>
      ) : null}
    </div>
  );
}
