// WS-7 — the "does a posted request actually get answered?" maths, kept pure so
// it can be tested without a database. The platform has no quote history yet, so
// the numbers on the admin page would otherwise be all-zero and unverifiable.
//
// Derived from the SOURCE OF TRUTH (looking_for_posts.created_at, which IS the
// publish time, vs looking_for_responses.sent_at) rather than from funnel
// events, so it stays correct for requests posted before instrumentation.

export type QuoteMetrics = {
  postsCreated: number;
  postsWithAnyQuote: number;
  postsWithTwoQuotesIn24h: number;
  /** Median hours from publish to the FIRST quote; null when no quotes yet. */
  medianHoursToFirstQuote: number | null;
};

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function summariseQuoteLatency(
  posts: { id: string; created_at: string }[],
  responses: { post_id: string; sent_at: string }[],
): QuoteMetrics {
  const byPost = new Map<string, number[]>();
  for (const r of responses) {
    const list = byPost.get(r.post_id) ?? [];
    list.push(new Date(r.sent_at).getTime());
    byPost.set(r.post_id, list);
  }

  let postsWithAnyQuote = 0;
  let postsWithTwoQuotesIn24h = 0;
  const firstQuoteHours: number[] = [];

  for (const p of posts) {
    const sent = byPost.get(p.id);
    if (!sent || sent.length === 0) continue;
    postsWithAnyQuote += 1;
    const publishedAt = new Date(p.created_at).getTime();
    // Quotes sent BEFORE the post cannot exist, but a clock skew or a re-sent
    // quote must never count twice — the window is [publish, publish+24h].
    const within24h = sent.filter(
      (t) => t >= publishedAt && t - publishedAt <= DAY_MS,
    ).length;
    if (within24h >= 2) postsWithTwoQuotesIn24h += 1;
    firstQuoteHours.push((Math.min(...sent) - publishedAt) / HOUR_MS);
  }

  return {
    postsCreated: posts.length,
    postsWithAnyQuote,
    postsWithTwoQuotesIn24h,
    medianHoursToFirstQuote: median(firstQuoteHours),
  };
}
