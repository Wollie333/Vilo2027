// Canonical feature catalog for Wielo products — reflects real app usage. The
// product editor builds its permission list from this (unioned with whatever a
// product already has set), so every meaningful capability is configurable.
//
// scope decides how a feature's allowance behaves:
//   "total"        → one absolute cap for the whole account (e.g. listings).
//   "per_business" → the cap is PER business; the effective allowance is
//                    cap × businesses_limit (e.g. each gateway is 1 per
//                    business, so Business=3 → 3 EFT configs allowed).
//   "toggle"       → on/off capability, no quantity.
// Quantity inputs are shown for "total" and "per_business"; toggles are on/off.
export type FeatureScope = "total" | "per_business" | "toggle";

export type CanonicalFeature = {
  key: string;
  label: string;
  scope: FeatureScope;
};

export const CANONICAL_PRODUCT_FEATURES: CanonicalFeature[] = [
  // Capacity (account totals)
  { key: "businesses_limit", label: "Businesses", scope: "total" },
  { key: "listings_limit", label: "Listings", scope: "total" },
  { key: "staff_seats", label: "Staff seats", scope: "total" },
  { key: "inbox_limit", label: "Active conversations", scope: "total" },
  // Payments — one config per business, scales with the business count
  {
    key: "payment_paystack",
    label: "Paystack payments",
    scope: "per_business",
  },
  { key: "payment_paypal", label: "PayPal payments", scope: "per_business" },
  { key: "payment_eft", label: "Manual EFT", scope: "per_business" },
  // Booking
  { key: "direct_booking", label: "Accept direct bookings", scope: "toggle" },
  { key: "instant_booking", label: "Instant booking", scope: "toggle" },
  { key: "enquiry_only", label: "Enquiry-only flow", scope: "toggle" },
  { key: "calendar_management", label: "Calendar management", scope: "toggle" },
  // Directory / profile
  { key: "directory_listing", label: "Listed in directory", scope: "toggle" },
  {
    key: "directory_priority",
    label: "Priority directory placement",
    scope: "toggle",
  },
  { key: "custom_profile_url", label: "Custom host page URL", scope: "toggle" },
  // Looking For (guest request marketplace). Access is the on/off gate.
  {
    key: "looking_for_access",
    label: "Looking For marketplace",
    scope: "toggle",
  },
  // ONE monthly Wielo-credit allowance — the single dial behind the single
  // balance (founder: "one simple credit system and top up system"). Credits are
  // spent per action: 1 to see a Looking-For request's details, 1 to quote.
  // "total" so the product editor renders a quantity input and the per-host
  // override form can raise it for one host. NULL = unlimited.
  // See docs/features/LOOKING_FOR_CREDIT_ALLOWANCES_PLAN.md
  {
    key: "wielo_credits_per_month",
    label: "Wielo credits / month",
    scope: "total",
  },
  // Website channel
  { key: "website_builder", label: "Website builder", scope: "toggle" },
  { key: "website_blog", label: "Website blog", scope: "toggle" },
  {
    key: "website_custom_domain",
    label: "Custom domain",
    scope: "per_business",
  },
  {
    key: "custom_website_design",
    label: "Done-for-you website design",
    scope: "toggle",
  },
  // Pricing — "total" so the product editor shows a quantity input: the max
  // number of seasonal-pricing rules the account may create (NULL = unlimited).
  // Enforced in the seasonal create actions; the gate's is_enabled unlocks the
  // feature, limit_value caps the count.
  {
    key: "seasonal_pricing",
    label: "Seasonal pricing rules",
    scope: "total",
  },
  // Merchandising
  { key: "specials", label: "Specials", scope: "toggle" },
  // Engagement
  { key: "inbox_messages", label: "Inbox", scope: "toggle" },
  { key: "reviews_respond", label: "Respond to reviews", scope: "toggle" },
  { key: "canned_replies", label: "Message templates", scope: "toggle" },
  // Insights
  { key: "reporting", label: "Reporting", scope: "toggle" },
  { key: "export_bookings", label: "CSV export", scope: "toggle" },
];

export const FEATURE_BY_KEY: Record<string, CanonicalFeature> =
  Object.fromEntries(CANONICAL_PRODUCT_FEATURES.map((f) => [f.key, f]));
