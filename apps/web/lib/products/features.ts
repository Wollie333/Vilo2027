// Canonical feature catalog for Vilo products — reflects real app usage. The
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
  // Engagement
  { key: "inbox_messages", label: "Inbox", scope: "toggle" },
  { key: "reviews_respond", label: "Respond to reviews", scope: "toggle" },
  { key: "canned_replies", label: "Message templates", scope: "toggle" },
  // Insights
  { key: "analytics_basic", label: "Basic analytics", scope: "toggle" },
  { key: "analytics_advanced", label: "Advanced analytics", scope: "toggle" },
  { key: "export_bookings", label: "CSV export", scope: "toggle" },
];

export const FEATURE_BY_KEY: Record<string, CanonicalFeature> =
  Object.fromEntries(CANONICAL_PRODUCT_FEATURES.map((f) => [f.key, f]));
