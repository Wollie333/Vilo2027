"use client";

import {
  type Account,
  BankAccountList,
} from "@/app/[locale]/dashboard/settings/banking/_components/BankAccountList";

// Setup "Payment method" step — the payout account(s) where guest payments
// land, also used on the EFT instructions guests pay into. Renders the SAME
// canonical BankAccountList as /dashboard/settings/banking (single source of
// truth). onChanged refreshes the wizard so the rail/completion update after an
// account is added or changed. Account numbers are encrypted at rest.
export function StepBanking({
  accounts,
  onChanged,
  onContinue,
}: {
  accounts: Account[];
  onChanged: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="-mt-1 text-sm text-brand-mute">
        Add the bank account where your payouts land. It&rsquo;s also used on
        the EFT instructions guests pay into. Account numbers are encrypted at
        rest.
      </p>

      <BankAccountList accounts={accounts} onChanged={onChanged} />

      {accounts.length > 0 ? (
        <div className="flex justify-end border-t border-brand-line pt-5">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
          >
            Save &amp; continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
