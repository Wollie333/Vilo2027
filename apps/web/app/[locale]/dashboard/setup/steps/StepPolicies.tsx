"use client";

import { CalendarClock, RotateCcw, ScrollText } from "lucide-react";

import type { PolicyCard } from "../../policies/PolicyManager";
import type { PolicyType } from "../../policies/schemas";
import { PolicyPicker } from "@/components/policy/PolicyPicker";

import type { Listing } from "../types";

type Props = {
  listing: Listing;
  policies: PolicyCard[];
  /** The listing-wide policy currently assigned for each kind (or null). */
  assignments: Partial<Record<PolicyType, string | null>>;
  onChanged: () => void;
  onContinue: () => void;
};

// Policies card — pick a system preset or create your own for each kind. Every
// policy is shared with /dashboard/policies (same `policies` table), and the
// chosen one is assigned to this listing listing-wide.
export function StepPolicies({
  listing,
  policies,
  assignments,
  onChanged,
  onContinue,
}: Props) {
  // A refund policy is the one thing we require before publishing.
  const canContinue = assignments.cancellation != null;

  return (
    <div className="space-y-8">
      {/* Refund terms */}
      <PolicySection
        icon={<RotateCcw className="h-4 w-4" />}
        title="Refund terms"
        blurb="How much guests get back when they cancel. Pick a preset or build your own."
      >
        <PolicyPicker
          listingId={listing.id}
          type="cancellation"
          policies={policies}
          assignedPolicyId={assignments.cancellation ?? null}
          onChanged={onChanged}
        />
      </PolicySection>

      {/* Check-in / Check-out */}
      <PolicySection
        icon={<CalendarClock className="h-4 w-4" />}
        title="Check-in & check-out"
        blurb="The arrival and departure times guests follow."
      >
        <PolicyPicker
          listingId={listing.id}
          type="check_in_out"
          policies={policies}
          assignedPolicyId={assignments.check_in_out ?? null}
          onChanged={onChanged}
        />
      </PolicySection>

      {/* House rules */}
      <PolicySection
        icon={<ScrollText className="h-4 w-4" />}
        title="House rules"
        blurb="What guests agree to when they book. Optional, but recommended."
      >
        <PolicyPicker
          listingId={listing.id}
          type="house_rules"
          policies={policies}
          assignedPolicyId={assignments.house_rules ?? null}
          onChanged={onChanged}
        />
      </PolicySection>

      {/* Continue */}
      <div className="flex items-center justify-between border-t border-brand-line pt-5">
        <span className="text-xs text-brand-mute">
          {canContinue
            ? "Refund terms set — you can fine-tune anytime from Policies."
            : "Pick or create refund terms to continue."}
        </span>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          Save &amp; continue
        </button>
      </div>
    </div>
  );
}

function PolicySection({
  icon,
  title,
  blurb,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
          {icon}
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-brand-ink">
            {title}
          </h3>
          <p className="text-xs text-brand-mute">{blurb}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
