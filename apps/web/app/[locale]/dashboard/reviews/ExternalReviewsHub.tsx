"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import {
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  connectExternalSourceAction,
  disconnectExternalSourceAction,
  getExternalSourcesAction,
  refreshExternalSourceAction,
} from "@/lib/external-reviews/actions";
import type { ExternalReviewSource } from "@/lib/external-reviews/types";

// Allowed image URL patterns for reviewer avatars (security)
const ALLOWED_AVATAR_HOSTS = [
  "lh3.googleusercontent.com",
  "graph.facebook.com",
  "www.gravatar.com",
  "avatars.githubusercontent.com",
  "platform-lookaside.fbsbx.com",
];

/**
 * Validate that an avatar URL is from a trusted source.
 * Returns null for invalid/untrusted URLs to prevent tracking pixels or malicious images.
 */
function getSafeAvatarUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (
      ALLOWED_AVATAR_HOSTS.some(
        (host) =>
          parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
      )
    ) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

// Platform icons (simple SVG icons)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TrustpilotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0l3.09 6.26L22 7.27l-5 4.87 1.18 6.88L12 15.77l-6.18 3.25L7 12.14 2 7.27l6.91-1.01L12 0z" />
    </svg>
  );
}

const SOURCE_CONFIG: Record<
  ExternalReviewSource,
  { name: string; icon: typeof GoogleIcon; color: string; description: string }
> = {
  google: {
    name: "Google",
    icon: GoogleIcon,
    color: "text-[#4285F4]",
    description: "Connect your Google Business Profile to import reviews.",
  },
  facebook: {
    name: "Facebook",
    icon: FacebookIcon,
    color: "text-[#1877F2]",
    description: "Connect your Facebook Page to import recommendations.",
  },
  trustpilot: {
    name: "Trustpilot",
    icon: TrustpilotIcon,
    color: "text-[#00B67A]",
    description: "Requires a Trustpilot Business subscription for API access.",
  },
};

interface SourceData {
  id: string;
  source: ExternalReviewSource;
  accountName: string | null;
  accountUrl: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export function ExternalReviewsHub({ hostId: _hostId }: { hostId: string }) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  // hostId available for future use (e.g., realtime subscriptions)
  void _hostId;

  const [sources, setSources] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load sources on mount
  useEffect(() => {
    async function loadSources() {
      try {
        const result = await getExternalSourcesAction();
        if (result.ok) {
          setSources(result.sources);
        } else {
          toast.error(result.error);
        }
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Failed to load sources";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }
    loadSources();
  }, []);

  const handleConnect = async (source: ExternalReviewSource) => {
    if (source === "trustpilot") {
      // TODO: Show Trustpilot API key entry form
      toast.error("Trustpilot integration coming soon");
      return;
    }

    startTransition(async () => {
      try {
        // This will redirect to the OAuth provider on success
        const result = await connectExternalSourceAction(source, locale);
        // If we get here without redirect, there was an error
        if (!result.ok) {
          toast.error(result.error);
        }
      } catch (e) {
        // Next.js redirect throws NEXT_REDIRECT which is expected
        if (e instanceof Error && e.message === "NEXT_REDIRECT") {
          return; // This is expected - OAuth redirect is happening
        }
        toast.error(`Failed to connect ${SOURCE_CONFIG[source].name}`);
      }
    });
  };

  const handleDisconnect = async (sourceId: string, sourceName: string) => {
    if (
      !confirm(`Disconnect ${sourceName}? Historical reviews will be kept.`)
    ) {
      return;
    }

    startTransition(async () => {
      const result = await disconnectExternalSourceAction(sourceId);
      if (result.ok) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        toast.success(`${sourceName} disconnected`);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleRefresh = async (sourceId: string, sourceName: string) => {
    startTransition(async () => {
      const result = await refreshExternalSourceAction(sourceId);
      if (result.ok) {
        toast.success(
          `${sourceName} synced: ${result.added} new, ${result.updated} updated`,
        );
        // Reload sources to get updated sync time
        const sourcesResult = await getExternalSourcesAction();
        if (sourcesResult.ok) {
          setSources(sourcesResult.sources);
        }
      } else {
        toast.error(result.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-mute" />
      </div>
    );
  }

  const connectedSources = new Set(sources.map((s) => s.source));

  return (
    <div className="space-y-6">
      {/* Connected Sources */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            Connected Sources
          </h2>
          <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Connect Platform
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect a Review Platform</DialogTitle>
                <DialogDescription>
                  Import reviews from external platforms to manage them all in
                  one place.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-3">
                {(
                  ["google", "facebook", "trustpilot"] as ExternalReviewSource[]
                ).map((source) => {
                  const config = SOURCE_CONFIG[source];
                  const Icon = config.icon;
                  const isConnected = connectedSources.has(source);

                  return (
                    <button
                      key={source}
                      onClick={() => {
                        if (!isConnected) {
                          handleConnect(source);
                          setConnectOpen(false);
                        }
                      }}
                      disabled={isConnected || isPending}
                      className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                        isConnected
                          ? "cursor-not-allowed border-brand-line/50 bg-brand-light/30 opacity-60"
                          : "border-brand-line hover:border-brand-primary hover:bg-brand-light/50"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ${config.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-brand-ink">
                          {config.name}
                          {isConnected && (
                            <span className="ml-2 text-xs text-status-confirmed">
                              Connected
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-brand-mute">
                          {config.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {sources.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-8 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent">
              <Globe className="h-6 w-6 text-brand-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-brand-ink">
              No external sources connected
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-mute">
              Connect your Google Business Profile, Facebook Page, or Trustpilot
              account to import reviews and manage them all in one place.
            </p>
            <Button
              onClick={() => setConnectOpen(true)}
              className="mt-4 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Connect a Platform
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => {
              const config = SOURCE_CONFIG[source.source];
              const Icon = config.icon;
              const lastSync = source.lastSyncedAt
                ? new Date(source.lastSyncedAt).toLocaleString("en-ZA", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "Never";

              return (
                <div
                  key={source.id}
                  className="rounded-card border border-brand-line bg-white p-5 shadow-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-brand-light ${config.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium text-brand-ink">
                          {source.accountName || config.name}
                        </div>
                        <div className="text-xs text-brand-mute">
                          {config.name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRefresh(source.id, config.name)}
                        disabled={isPending}
                        className="rounded p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                        title="Sync now"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() => handleDisconnect(source.id, config.name)}
                        disabled={isPending}
                        className="rounded p-1.5 text-brand-mute hover:bg-status-cancelled/10 hover:text-status-cancelled"
                        title="Disconnect"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-brand-mute">
                      <span>Last synced</span>
                      <span className="font-medium text-brand-ink">
                        {lastSync}
                      </span>
                    </div>
                    {source.lastSyncError && (
                      <div className="rounded bg-status-cancelled/10 px-2 py-1.5 text-status-cancelled">
                        Error: {source.lastSyncError}
                      </div>
                    )}
                    {source.accountUrl && (
                      <a
                        href={source.accountUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                      >
                        View on {config.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* External Reviews Feed */}
      {sources.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            External Reviews
          </h2>
          <ExternalReviewsFeed sources={sources} />
        </section>
      )}
    </div>
  );
}

// External reviews feed component with full functionality
function ExternalReviewsFeed({ sources }: { sources: SourceData[] }) {
  const [reviews, setReviews] = useState<
    import("@/lib/external-reviews/actions").ExternalReviewDisplay[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExternalReviewSource | "all">("all");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [properties, setProperties] = useState<{ id: string; name: string }[]>(
    [],
  );

  // The host's places, for the mapping dropdown below. Until a review is mapped
  // to one, `external_reviews.property_id` stays NULL and the public property
  // page — which filters on it — can never show the review. That was the whole
  // point of importing them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getHostPropertiesAction } =
        await import("@/lib/external-reviews/actions");
      const result = await getHostPropertiesAction();
      if (!cancelled && result.ok) setProperties(result.properties);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Import the action dynamically to avoid server/client mismatch
  const loadReviews = useCallback(
    async (offset = 0, append = false) => {
      try {
        const { getExternalReviewsAction } =
          await import("@/lib/external-reviews/actions");
        const result = await getExternalReviewsAction({
          sourceFilter: filter === "all" ? undefined : filter,
          limit: 20,
          offset,
        });

        if (result.ok) {
          if (append) {
            setReviews((prev) => [...prev, ...result.reviews]);
          } else {
            setReviews(result.reviews);
          }
          setTotal(result.total);
          setHasMore(result.hasMore);
          setError(null);
        } else {
          setError(result.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reviews");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter],
  );

  // Initial load and filter change
  useEffect(() => {
    setLoading(true);
    loadReviews(0, false);
  }, [loadReviews]);

  // Load more handler
  const handleLoadMore = () => {
    setLoadingMore(true);
    loadReviews(reviews.length, true);
  };

  // Toggle visibility handler
  const handleToggleVisibility = async (
    reviewId: string,
    currentVisible: boolean,
  ) => {
    startTransition(async () => {
      const { toggleExternalReviewVisibilityAction } =
        await import("@/lib/external-reviews/actions");
      const result = await toggleExternalReviewVisibilityAction(
        reviewId,
        !currentVisible,
      );
      if (result.ok) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, isVisible: !currentVisible } : r,
          ),
        );
        toast.success(
          currentVisible
            ? "Review hidden from website"
            : "Review visible on website",
        );
      } else {
        toast.error(result.error);
      }
    });
  };

  // Toggle featured handler
  const handleToggleFeatured = async (
    reviewId: string,
    currentFeatured: boolean,
  ) => {
    startTransition(async () => {
      const { toggleExternalReviewFeaturedAction } =
        await import("@/lib/external-reviews/actions");
      const result = await toggleExternalReviewFeaturedAction(
        reviewId,
        !currentFeatured,
      );
      if (result.ok) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId ? { ...r, isFeatured: !currentFeatured } : r,
          ),
        );
        toast.success(
          currentFeatured ? "Review unfeatured" : "Review featured",
        );
      } else {
        toast.error(result.error);
      }
    });
  };

  // Map a review to one of the host's properties (or clear it).
  const handleMapProperty = async (
    reviewId: string,
    propertyId: string | null,
  ) => {
    startTransition(async () => {
      const { mapExternalReviewToPropertyAction } =
        await import("@/lib/external-reviews/actions");
      const result = await mapExternalReviewToPropertyAction(
        reviewId,
        propertyId,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                propertyId,
                propertyName:
                  properties.find((p) => p.id === propertyId)?.name ?? null,
              }
            : r,
        ),
      );
      toast.success(
        propertyId
          ? "Review linked — it can now show on that property's page."
          : "Review unlinked from the property.",
      );
    });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-pill bg-brand-line/30"
            />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-card border border-brand-line bg-white p-5 shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-brand-line/30" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-brand-line/30" />
                  <div className="h-3 w-24 animate-pulse rounded bg-brand-line/30" />
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div
                      key={s}
                      className="h-4 w-4 animate-pulse rounded bg-brand-line/30"
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-brand-line/30" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-brand-line/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-card border border-status-cancelled/30 bg-status-cancelled/5 p-6 text-center">
        <p className="text-sm text-status-cancelled">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadReviews(0, false)}
          className="mt-3"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // Empty state
  if (reviews.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent">
          <Star className="h-6 w-6 text-brand-primary" />
        </div>
        <h3 className="font-display text-lg font-semibold text-brand-ink">
          No external reviews yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-mute">
          Reviews will appear here after you sync your connected platforms.
          Click the refresh button on a source to start syncing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-brand-secondary text-white"
              : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light"
          }`}
        >
          All ({total})
        </button>
        {sources.map((s) => {
          const config = SOURCE_CONFIG[s.source];
          return (
            <button
              key={s.source}
              onClick={() => setFilter(s.source)}
              className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s.source
                  ? "bg-brand-secondary text-white"
                  : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light"
              }`}
            >
              {config.name}
            </button>
          );
        })}
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {reviews.map((review) => {
          const config = SOURCE_CONFIG[review.source];
          const Icon = config.icon;

          return (
            <div
              key={review.id}
              className={`rounded-card border bg-white p-5 shadow-card transition-all ${
                review.isFeatured
                  ? "border-brand-primary/30 ring-1 ring-brand-primary/20"
                  : "border-brand-line"
              } ${!review.isVisible ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const safeAvatar = getSafeAvatarUrl(review.reviewerAvatar);
                    return safeAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={safeAvatar}
                        alt={review.reviewerName || "Reviewer"}
                        className="h-10 w-10 rounded-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-brand-light ${config.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-brand-ink">
                        {review.reviewerName || "Anonymous"}
                      </span>
                      {review.isFeatured && (
                        <span className="rounded-pill bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-primary">
                          Featured
                        </span>
                      )}
                      {!review.isVisible && (
                        <span className="rounded-pill bg-brand-mute/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-mute">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-brand-mute">
                      <span>
                        {new Date(review.reviewedAt).toLocaleDateString(
                          "en-ZA",
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${config.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {config.name}
                      </span>
                      {/* The mapping dropdown. A review with no property_id
                          cannot render on any property page, so an unmapped
                          review says so rather than showing nothing. */}
                      {properties.length > 0 ? (
                        <label className="flex items-center gap-1">
                          <span className="sr-only">
                            Link this review to a property
                          </span>
                          <select
                            value={review.propertyId ?? ""}
                            disabled={isPending}
                            onChange={(e) =>
                              handleMapProperty(
                                review.id,
                                e.target.value === "" ? null : e.target.value,
                              )
                            }
                            className={`max-w-[170px] truncate rounded border bg-white px-1.5 py-0.5 text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 disabled:opacity-50 ${
                              review.propertyId
                                ? "border-brand-line text-brand-ink"
                                : "border-amber-300 bg-amber-50 text-amber-700"
                            }`}
                          >
                            <option value="">Not shown on a page —</option>
                            {properties.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : review.propertyName ? (
                        <span className="max-w-[150px] truncate">
                          → {review.propertyName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-brand-line text-brand-line"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {review.body && (
                <p className="mt-3 text-sm leading-relaxed text-brand-ink">
                  {review.body}
                </p>
              )}

              {review.hostReply && (
                <div className="mt-3 rounded-lg border border-brand-line/50 bg-brand-light/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-brand-mute">
                    <span>Your reply</span>
                    {review.replySynced ? (
                      <span className="text-status-confirmed">Synced</span>
                    ) : review.replySyncError ? (
                      <span className="text-status-cancelled">
                        Failed: {review.replySyncError}
                      </span>
                    ) : (
                      <span className="text-brand-mute">Pending sync</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-brand-ink">
                    {review.hostReply}
                  </p>
                </div>
              )}

              {/* Actions row */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-line/50 pt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleToggleVisibility(review.id, review.isVisible)
                    }
                    disabled={isPending}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      review.isVisible
                        ? "bg-brand-light text-brand-mute hover:bg-brand-line/50"
                        : "bg-status-confirmed/10 text-status-confirmed hover:bg-status-confirmed/20"
                    }`}
                  >
                    {review.isVisible ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() =>
                      handleToggleFeatured(review.id, review.isFeatured)
                    }
                    disabled={isPending}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      review.isFeatured
                        ? "bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
                        : "bg-brand-light text-brand-mute hover:bg-brand-line/50"
                    }`}
                  >
                    {review.isFeatured ? "Unfeature" : "Feature"}
                  </button>
                </div>
                {review.reviewUrl && (
                  <a
                    href={review.reviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                  >
                    View original
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-1.5"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>Load More</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
