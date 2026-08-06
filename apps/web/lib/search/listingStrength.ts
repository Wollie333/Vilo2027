// Listing Strength — the host-facing, transparent view of directory ranking.
//
// It reuses the SAME signals the ranking algorithm uses (see migration
// 20260806170000 recalculate_listing_ranking + the search_directory RPC), so a
// host sees exactly why they rank and what to change. The headline number is the
// stored ranking_score (the algorithm's own value — no second, drifting maths),
// and the raw inputs drive the "quick wins" checklist.
//
// Deliberately framework-free so both the editor tab and the listings-list badge
// can call it.

export type StrengthBand = "strong" | "good" | "building" | "weak";

/** A ranking component shown as a bar with the weight it carries. */
export type StrengthComponent = {
  key: "rating" | "reviews" | "optimisation" | "responsiveness";
  label: string;
  /** 0–100 fill for this component's own value. */
  pct: number;
  /** How much of the total score this component can contribute, as a %. */
  weightPct: number;
  tip: string;
};

/** A concrete, coachable action the host fully controls. */
export type StrengthChecklistItem = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  /** Editor tab that fixes it (matches Editor TabKey values). */
  tab: string;
  impact: "high" | "medium";
};

export type ListingStrength = {
  /** 0–100 — the stored ranking_score, scaled. Matches the live algorithm. */
  score: number;
  band: StrengthBand;
  /** ISO timestamp of the last ranking recompute, or null if never. */
  lastCalculated: string | null;
  components: StrengthComponent[];
  checklist: StrengthChecklistItem[];
  /** How many checklist wins are still open. */
  openWins: number;
  /** Keyword/relevance nudge, or null when the name already reads well. */
  keywordTip: string | null;
};

export type ListingStrengthInput = {
  // Stored ranking row (authoritative). All 0–1; null when not yet computed.
  rankingScore: number | null;
  componentRating: number | null;
  componentReviews: number | null;
  componentProfile: number | null;
  componentResponse: number | null;
  lastCalculated: string | null;
  // Raw signals, for the checklist + human copy.
  name: string;
  city: string | null;
  hasDescription: boolean;
  hasCheckInTime: boolean;
  photoCount: number;
  amenityCount: number;
};

// Component weights, mirrored from platform_settings.ranking_weights defaults.
// Kept here only for display ("30% of your score"); the score itself comes from
// the stored ranking_score so the two can never disagree.
const WEIGHT = {
  rating: 30,
  reviews: 20,
  optimisation: 30,
  responsiveness: 20,
};

function bandFor(score: number): StrengthBand {
  if (score >= 75) return "strong";
  if (score >= 50) return "good";
  if (score >= 25) return "building";
  return "weak";
}

const clampPct = (n: number | null): number =>
  Math.max(0, Math.min(100, Math.round((n ?? 0) * 100)));

export function computeListingStrength(
  input: ListingStrengthInput,
): ListingStrength {
  const score = clampPct(input.rankingScore);

  const components: StrengthComponent[] = [
    {
      key: "rating",
      label: "Guest rating",
      pct: clampPct(input.componentRating),
      weightPct: WEIGHT.rating,
      tip: "Earned from real guest reviews — deliver great stays.",
    },
    {
      key: "reviews",
      label: "Review volume",
      pct: clampPct(input.componentReviews),
      weightPct: WEIGHT.reviews,
      tip: "Invite every guest to review after checkout.",
    },
    {
      key: "optimisation",
      label: "Listing optimisation",
      pct: clampPct(input.componentProfile),
      weightPct: WEIGHT.optimisation,
      tip: "The part you fully control — complete the quick wins below.",
    },
    {
      key: "responsiveness",
      label: "Responsiveness",
      pct: clampPct(input.componentResponse),
      weightPct: WEIGHT.responsiveness,
      tip: "Reply to enquiries quickly to build this up.",
    },
  ];

  // Mirrors recalculate_listing_ranking()'s profile sub-scores exactly.
  const checklist: StrengthChecklistItem[] = [
    {
      key: "description",
      label: "Write a description",
      hint: "Tell guests what makes this place special.",
      done: input.hasDescription,
      tab: "basic",
      impact: "medium",
    },
    {
      key: "city",
      label: "Set your town / city",
      hint: "Powers location searches like “stays in Durban”.",
      done: Boolean(input.city),
      tab: "location",
      impact: "medium",
    },
    {
      key: "photos",
      label: "Add at least 5 photos",
      hint: `You have ${input.photoCount}. Listings with 5+ photos rank higher.`,
      done: input.photoCount >= 5,
      tab: "photos",
      impact: "high",
    },
    {
      key: "checkin",
      label: "Set your check-in time",
      hint: "A small but real completeness signal.",
      done: input.hasCheckInTime,
      tab: "settings",
      impact: "medium",
    },
    {
      key: "amenities",
      label: "List at least 3 amenities",
      hint: `You have ${input.amenityCount}. Amenities also power guest filters.`,
      done: input.amenityCount >= 3,
      tab: "amenities",
      impact: "medium",
    },
  ];

  // Relevance nudge: the listing name is the highest-weighted field for keyword
  // search, so a name that names its area is found more often.
  const city = input.city?.trim();
  const keywordTip =
    city && !input.name.toLowerCase().includes(city.toLowerCase())
      ? `Guests who search “${city}” match your name less strongly. Consider mentioning the area in the listing name.`
      : null;

  return {
    score,
    band: bandFor(score),
    lastCalculated: input.lastCalculated,
    components,
    checklist,
    openWins: checklist.filter((c) => !c.done).length,
    keywordTip,
  };
}

export const STRENGTH_BAND_LABEL: Record<StrengthBand, string> = {
  strong: "Strong — you’re competing well",
  good: "Good — a few quick wins left",
  building: "Building — plenty of easy gains",
  weak: "Just starting — complete the basics",
};
