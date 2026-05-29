"use client";

import {
  type Account,
  BankAccountList,
} from "@/app/dashboard/settings/banking/_components/BankAccountList";
import { BusinessDetailsForm } from "@/app/dashboard/settings/banking/_components/BusinessDetailsForm";
import type { BusinessDetailsInput } from "@/app/dashboard/settings/banking/schemas";

// Setup "Business info" card — renders the SAME canonical components as
// /dashboard/settings/banking (single source of truth): business details
// first, then payout accounts. onChanged refreshes the wizard so the rail /
// completion update after an account is added or changed.
export function StepBanking({
  accounts,
  businessDefaults,
  onChanged,
  onContinue,
}: {
  accounts: Account[];
  businessDefaults: BusinessDetailsInput;
  onChanged: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="-mt-1 text-sm text-brand-mute">
        Your business details and payout accounts — used on EFT instructions,
        invoices and quotes. Account numbers are encrypted at rest.
      </p>

      <BusinessDetailsForm defaults={businessDefaults} onSaved={onChanged} />
      <BankAccountList accounts={accounts} onChanged={onChanged} />

      {accounts.length > 0 ? (
        <div className="flex justify-end border-t border-brand-line pt-5">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
          >
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
