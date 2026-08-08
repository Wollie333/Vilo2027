"use client";

import { BusinessDetailsForm } from "@/app/[locale]/dashboard/settings/banking/_components/BusinessDetailsForm";
import type { BusinessDetailsInput } from "@/app/[locale]/dashboard/settings/banking/schemas";

// Setup "Business name & details" step — the trading/legal identity that
// appears on invoices, quotes and EFT instructions. Renders the same canonical
// BusinessDetailsForm as /dashboard/settings/banking (single source of truth).
// onChanged refreshes the wizard so the rail/completion update after a save.
export function StepBusiness({
  businessDefaults,
  nameSet,
  addressSet,
  onChanged,
  onContinue,
}: {
  businessDefaults: BusinessDetailsInput;
  /** True once a trading/legal name is saved. */
  nameSet: boolean;
  /** True once a billing address (line 1 + city + postcode) is saved. Together
      with nameSet this gates Continue — the leaner signup no longer captures an
      address, so it's captured here for invoices/quotes/EFT. */
  addressSet: boolean;
  onChanged: () => void;
  onContinue: () => void;
}) {
  const ready = nameSet && addressSet;
  return (
    <div className="space-y-5">
      <p className="-mt-1 text-sm text-brand-mute">
        Your business name and address — shown on invoices, quotes and EFT
        payment instructions. You can refine this anytime from Settings.
      </p>

      <BusinessDetailsForm
        defaults={businessDefaults}
        requireName
        requireAddress
        onSaved={onChanged}
      />

      <div className="flex items-center justify-between border-t border-brand-line pt-5">
        <span className="text-xs text-brand-mute">
          {ready
            ? "Business details saved — continue when you're ready."
            : !nameSet
              ? "Add your business name above, then continue."
              : "Add your business address above, then continue."}
        </span>
        <button
          type="button"
          onClick={onContinue}
          disabled={!ready}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          Save &amp; continue
        </button>
      </div>
    </div>
  );
}
