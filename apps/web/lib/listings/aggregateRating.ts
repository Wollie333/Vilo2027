/**
 * Aggregate rating calculation across Vilo internal reviews and external
 * review sources (Google, Facebook, Trustpilot).
 */

export type ReviewSource = "vilo" | "google" | "facebook" | "trustpilot";

export type SourceRating = {
  source: ReviewSource;
  count: number;
  average: number;
  label: string;
};

export type AggregatedRating = {
  /** Combined average across all sources, weighted by review count. */
  overall: number;
  /** Total reviews across all sources. */
  totalCount: number;
  /** Breakdown by source. */
  sources: SourceRating[];
};

const SOURCE_LABELS: Record<ReviewSource, string> = {
  vilo: "Vilo",
  google: "Google",
  facebook: "Facebook",
  trustpilot: "Trustpilot",
};

/**
 * Calculates a weighted average across multiple review sources.
 *
 * @param sources - Array of { source, count, average } from each platform.
 * @returns Combined rating with source breakdown.
 */
export function aggregateRating(
  sources: Array<{ source: ReviewSource; count: number; average: number }>,
): AggregatedRating {
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0);

  // Weighted average: sum(count * avg) / total
  const overall =
    totalCount > 0
      ? Math.round(
          (sources.reduce((sum, s) => sum + s.count * s.average, 0) /
            totalCount) *
            100,
        ) / 100
      : 0;

  const orderedSources: SourceRating[] = sources
    .filter((s) => s.count > 0)
    .map((s) => ({
      source: s.source,
      count: s.count,
      average: Math.round(s.average * 100) / 100,
      label: SOURCE_LABELS[s.source],
    }))
    // Sort by count descending (most reviews first)
    .sort((a, b) => b.count - a.count);

  return {
    overall,
    totalCount,
    sources: orderedSources,
  };
}

/**
 * Formats the aggregated rating for display as a tooltip.
 * e.g. "4.72 from 42 reviews (32 Vilo, 8 Google, 2 Facebook)"
 */
export function formatAggregatedRatingTooltip(
  rating: AggregatedRating,
): string {
  if (rating.totalCount === 0) return "No reviews yet";

  const breakdown = rating.sources
    .map((s) => `${s.count} ${s.label}`)
    .join(", ");

  return `${rating.overall.toFixed(2)} from ${rating.totalCount} review${rating.totalCount === 1 ? "" : "s"} (${breakdown})`;
}
