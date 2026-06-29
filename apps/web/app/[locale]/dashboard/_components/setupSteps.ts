import type { GettingStartedState } from "@/lib/help/queries";

export type SetupStepKey =
  | "email_verified"
  | "profile_completed"
  | "first_listing"
  | "paystack_verified"
  | "policies_set"
  | "listing_published";

export type SetupStep = {
  key: SetupStepKey;
  title: string;
  description: string;
  meta?: string;
  done: boolean;
  href: string;
  ctaLabel: string;
};

// Every CTA points into the guided wizard at /dashboard/setup with a
// ?step= deep-link so the wizard auto-jumps to the right pane. The wizard
// itself is the single source of truth for finishing setup — the routes
// it would otherwise be linked to (/settings/payouts, /settings/policies)
// don't exist as standalone pages.
export function buildSetupSteps(state: GettingStartedState): SetupStep[] {
  return [
    {
      key: "email_verified",
      title: "Verify your email address",
      description: "Verifying unlocks payouts and guest messaging.",
      meta: state.email_verified.meta,
      done: state.email_verified.done,
      href: "/dashboard/setup?step=profile",
      ctaLabel: "Resend link",
    },
    {
      key: "profile_completed",
      title: "Complete your host profile",
      description:
        "Profile photo, short bio, languages spoken — guests see this on your page.",
      meta: state.profile_completed.meta,
      done: state.profile_completed.done,
      href: "/dashboard/setup?step=profile",
      ctaLabel: "Continue",
    },
    {
      key: "first_listing",
      title: "Add photos, pricing and rooms to your listing",
      description:
        "Pictures, nightly rate, capacity, and rooms — everything needed to take bookings.",
      meta: state.first_listing.meta,
      done: state.first_listing.done,
      href: "/dashboard/setup?step=listing",
      ctaLabel: "Continue",
    },
    {
      key: "paystack_verified",
      title: "Add your banking details",
      description:
        "EFT for now — Paystack and PayPal connect from Settings once you've made your first booking.",
      meta: state.paystack_verified.meta,
      done: state.paystack_verified.done,
      href: "/dashboard/setup?step=banking",
      ctaLabel: "Add",
    },
    {
      key: "policies_set",
      title: "Choose a cancellation policy",
      description:
        "Flexible, Moderate, or Strict. Plus check-in / check-out times and house rules.",
      meta: state.policies_set.meta,
      done: state.policies_set.done,
      href: "/dashboard/setup?step=policies",
      ctaLabel: "Choose",
    },
    {
      key: "listing_published",
      title: "Publish your booking page",
      description:
        "Share wieloplatform.com/your-handle anywhere — Instagram bio, WhatsApp, email signature.",
      meta: state.listing_published.meta,
      done: state.listing_published.done,
      href: "/dashboard/setup?step=review",
      ctaLabel: "Publish",
    },
  ];
}

export function setupProgress(steps: SetupStep[]) {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / total) * 100);
  const firstIncompleteIdx = steps.findIndex((s) => !s.done);
  const nextStep =
    firstIncompleteIdx >= 0 ? steps[firstIncompleteIdx] : undefined;
  return { total, done, pct, firstIncompleteIdx, nextStep };
}
