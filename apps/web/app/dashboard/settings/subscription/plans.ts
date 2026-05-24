// Pricing from vilo-platform-mvp.md §6.6B.
// Annual = 10 × monthly (two months free, ~16.7% off).

export type PlanKey = "free" | "basic" | "pro" | "business";

export type PlanDef = {
  key: PlanKey;
  name: string;
  tagline: string;
  monthly: number; // ZAR
  annual: number; // ZAR — full annual price
  bullets: string[];
  recommended?: boolean;
};

export const PLANS: ReadonlyArray<PlanDef> = [
  {
    key: "free",
    name: "Free",
    tagline: "Get listed, no card required.",
    monthly: 0,
    annual: 0,
    bullets: [
      "Appear in the Vilo Directory",
      "1 listing",
      "Up to 10 active conversations",
      "Enquiry-only — no in-platform payments",
    ],
  },
  {
    key: "basic",
    name: "Basic",
    tagline: "For solo hosts running one place.",
    monthly: 299,
    annual: 2990,
    bullets: [
      "Direct bookings + Paystack, PayPal, EFT",
      "1 listing, 1 staff seat",
      "Instant booking + calendar management",
      "Respond to reviews",
      "Custom host page",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "For growing portfolios up to 5 listings.",
    monthly: 599,
    annual: 5990,
    recommended: true,
    bullets: [
      "Everything in Basic",
      "Up to 5 listings, 3 staff seats",
      "Priority directory placement",
      "Advanced analytics + CSV export",
      "Message templates (canned replies)",
    ],
  },
  {
    key: "business",
    name: "Business",
    tagline: "Unlimited listings for serious operators.",
    monthly: 1199,
    annual: 11990,
    bullets: [
      "Everything in Pro",
      "Unlimited listings, 10 staff seats",
      "Top directory placement",
      "All features unlocked",
    ],
  },
];

export function findPlan(key: string | null | undefined): PlanDef | null {
  if (!key) return null;
  return PLANS.find((p) => p.key === key) ?? null;
}

export function formatZar(amount: number): string {
  if (amount === 0) return "Free";
  return `R ${amount.toLocaleString("en-ZA").replace(/,/g, " ")}`;
}
