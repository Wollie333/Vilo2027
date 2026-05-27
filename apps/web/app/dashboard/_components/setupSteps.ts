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

export function buildSetupSteps(state: GettingStartedState): SetupStep[] {
  return [
    {
      key: "email_verified",
      title: "Verify your email address",
      description: "Verifying unlocks payouts and guest messaging.",
      meta: state.email_verified.meta,
      done: state.email_verified.done,
      href: "/dashboard/settings",
      ctaLabel: "Resend link",
    },
    {
      key: "profile_completed",
      title: "Complete your host profile",
      description:
        "Profile photo, short bio, languages spoken — guests see this on your page.",
      meta: state.profile_completed.meta,
      done: state.profile_completed.done,
      href: "/dashboard/settings",
      ctaLabel: "Continue",
    },
    {
      key: "first_listing",
      title: "Create your first listing",
      description:
        "Pictures, pricing, amenities, house rules. Save as draft anytime.",
      meta: state.first_listing.meta,
      done: state.first_listing.done,
      href: "/dashboard/listings/new",
      ctaLabel: "Start",
    },
    {
      key: "paystack_verified",
      title: "Connect Paystack for ZAR payouts",
      description: "Or use PayPal / manual EFT. Connect one before publishing.",
      meta: state.paystack_verified.meta,
      done: state.paystack_verified.done,
      href: "/dashboard/settings/payouts",
      ctaLabel: "Connect",
    },
    {
      key: "policies_set",
      title: "Choose a cancellation policy",
      description:
        "Flexible, Moderate, or Strict. Vilo's recommended template is preselected.",
      meta: state.policies_set.meta,
      done: state.policies_set.done,
      href: "/dashboard/settings/policies",
      ctaLabel: "Choose",
    },
    {
      key: "listing_published",
      title: "Publish your booking page",
      description:
        "Share viloplatform.com/your-handle anywhere — Instagram bio, WhatsApp, email signature.",
      meta: state.listing_published.meta,
      done: state.listing_published.done,
      href: "/dashboard/listings",
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
