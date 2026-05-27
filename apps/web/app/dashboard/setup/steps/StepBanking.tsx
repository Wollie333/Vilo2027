"use client";

import { Building2, CheckCircle2, CreditCard, Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  SA_BANKS,
} from "../../settings/banking/schemas";
import {
  createBankAccountAction,
  saveBusinessDetailsAction,
} from "../../settings/banking/actions";
import type { BankAccount, BusinessDetails } from "../types";

type Props = {
  hostId: string;
  bankAccounts: BankAccount[];
  businessDetails: BusinessDetails | null;
  onAccountSaved: (acc: BankAccount) => void;
  onBusinessSaved: (b: BusinessDetails) => void;
  onContinue: () => void;
};

export function StepBanking({
  bankAccounts,
  businessDetails,
  onAccountSaved,
  onBusinessSaved,
  onContinue,
}: Props) {
  const hasAccount = bankAccounts.length > 0;

  // Bank account form
  const [label, setLabel] = useState("Main account");
  const [bankSelect, setBankSelect] =
    useState<(typeof SA_BANKS)[number]>("FNB");
  const [bankNameOther, setBankNameOther] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] =
    useState<(typeof ACCOUNT_TYPES)[number]>("cheque");
  const [branchCode, setBranchCode] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [referenceFormat, setReferenceFormat] = useState("Guest surname");

  // Business form
  const [legalName, setLegalName] = useState(businessDetails?.legal_name ?? "");
  const [tradingName, setTradingName] = useState(
    businessDetails?.trading_name ?? "",
  );
  const [vatNumber, setVatNumber] = useState(businessDetails?.vat_number ?? "");
  const [companyReg, setCompanyReg] = useState(
    businessDetails?.company_registration_number ?? "",
  );
  const [addr1, setAddr1] = useState(
    businessDetails?.billing_address_line1 ?? "",
  );
  const [addr2, setAddr2] = useState(
    businessDetails?.billing_address_line2 ?? "",
  );
  const [city, setCity] = useState(businessDetails?.billing_city ?? "");
  const [postcode, setPostcode] = useState(
    businessDetails?.billing_postcode ?? "",
  );
  const [country, setCountry] = useState(
    businessDetails?.billing_country ?? "ZA",
  );

  const [accountPending, startAccount] = useTransition();
  const [businessPending, startBusiness] = useTransition();

  function onSaveAccount() {
    // Validate locally with the same rules the server schema enforces, so
    // the user sees the specific field that's wrong instead of a generic
    // "please check the form" toast.
    if (!label.trim()) {
      toast.error("Give this account a label.");
      return;
    }
    if (bankSelect === "Other" && !bankNameOther.trim()) {
      toast.error("Enter the bank name.");
      return;
    }
    if (accountHolder.trim().length < 2) {
      toast.error("Enter the account holder name (at least 2 characters).");
      return;
    }
    if (!/^\d{6,16}$/.test(accountNumber.trim())) {
      toast.error("Account number must be 6 to 16 digits.");
      return;
    }
    if (!/^\d{6}$/.test(branchCode.trim())) {
      toast.error("Branch code must be exactly 6 digits.");
      return;
    }
    if (swiftCode.trim() && swiftCode.trim().length > 11) {
      toast.error("SWIFT / BIC is at most 11 characters.");
      return;
    }
    if (!referenceFormat.trim()) {
      toast.error("Reference format is required.");
      return;
    }
    startAccount(async () => {
      const result = await createBankAccountAction({
        label: label.trim(),
        bank_select: bankSelect,
        bank_name_other: bankNameOther.trim(),
        account_holder: accountHolder.trim(),
        account_number: accountNumber.trim(),
        account_type: accountType,
        branch_code: branchCode.trim(),
        swift_code: swiftCode.trim(),
        reference_format: referenceFormat.trim(),
        is_default: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onAccountSaved({
        id: `temp-${Date.now()}`,
        label: label.trim(),
        bank_name: bankSelect === "Other" ? bankNameOther.trim() : bankSelect,
        account_holder: accountHolder.trim(),
        account_last4: accountNumber.trim().slice(-4),
        branch_code: branchCode.trim(),
        account_type: accountType,
        is_default: true,
      });
      toast.success("Bank account saved.");
      setAccountNumber("");
    });
  }

  function onSaveBusiness() {
    startBusiness(async () => {
      const result = await saveBusinessDetailsAction({
        legal_name: legalName.trim(),
        trading_name: tradingName.trim(),
        vat_number: vatNumber.trim(),
        company_registration_number: companyReg.trim(),
        billing_address_line1: addr1.trim(),
        billing_address_line2: addr2.trim(),
        billing_city: city.trim(),
        billing_postcode: postcode.trim(),
        billing_country: country.trim().toUpperCase().slice(0, 2),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onBusinessSaved({
        legal_name: legalName.trim(),
        trading_name: tradingName.trim(),
        vat_number: vatNumber.trim(),
        company_registration_number: companyReg.trim(),
        billing_address_line1: addr1.trim(),
        billing_address_line2: addr2.trim(),
        billing_city: city.trim(),
        billing_postcode: postcode.trim(),
        billing_country: country.trim().toUpperCase().slice(0, 2),
      });
      toast.success("Business details saved.");
    });
  }

  return (
    <div className="space-y-8">
      {/* Bank account section */}
      <section>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Where should we pay you?
            </h3>
            <p className="text-xs text-brand-mute">
              South African EFT only for now — Paystack and PayPal connect from
              Settings once you&rsquo;ve made your first booking.
            </p>
          </div>
        </div>

        {hasAccount ? (
          <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-semibold text-brand-ink">
                  {bankAccounts[0].bank_name} ····{" "}
                  {bankAccounts[0].account_last4}
                </div>
                <div className="text-xs text-brand-mute">
                  {bankAccounts[0].account_holder} ·{" "}
                  {ACCOUNT_TYPE_LABELS[
                    bankAccounts[0]
                      .account_type as keyof typeof ACCOUNT_TYPE_LABELS
                  ] ?? bankAccounts[0].account_type}
                </div>
              </div>
              <span className="rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Default
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded border border-brand-line bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Bank">
                <select
                  value={bankSelect}
                  onChange={(e) =>
                    setBankSelect(e.target.value as (typeof SA_BANKS)[number])
                  }
                  className="input"
                >
                  {SA_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
              {bankSelect === "Other" ? (
                <Field label="Bank name" className="sm:col-span-2">
                  <input
                    type="text"
                    value={bankNameOther}
                    onChange={(e) => setBankNameOther(e.target.value)}
                    className="input"
                  />
                </Field>
              ) : null}
              <Field label="Account holder" className="sm:col-span-2">
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="As it appears on the account"
                  className="input"
                />
              </Field>
              <Field label="Account number">
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) =>
                    setAccountNumber(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="6–16 digits"
                  className="input"
                />
              </Field>
              <Field label="Account type">
                <select
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(
                      e.target.value as (typeof ACCOUNT_TYPES)[number],
                    )
                  }
                  className="input"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Branch code" hint="6 digits, no spaces.">
                <input
                  type="text"
                  inputMode="numeric"
                  value={branchCode}
                  onChange={(e) =>
                    setBranchCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="e.g. 250655"
                  className="input"
                />
              </Field>
              <Field label="SWIFT / BIC" hint="Optional — for foreign payers.">
                <input
                  type="text"
                  value={swiftCode}
                  onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FIRNZAJJ"
                  className="input"
                />
              </Field>
              <Field
                label="Reference format"
                hint="How guests label their deposits."
                className="sm:col-span-2"
              >
                <input
                  type="text"
                  value={referenceFormat}
                  onChange={(e) => setReferenceFormat(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-brand-mute">
              <Lock className="h-3 w-3" />
              The account number is encrypted at rest. Only the last 4 digits
              are visible after save.
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onSaveAccount}
                disabled={accountPending}
                className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
              >
                {accountPending ? "Saving…" : "Save bank account"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Business details section */}
      <section>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Business details
            </h3>
            <p className="text-xs text-brand-mute">
              Optional — needed if you want VAT invoices for your guests, or
              you&rsquo;re trading under a registered company.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded border border-brand-line bg-white p-4 sm:grid-cols-2">
          <Field label="Legal name">
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Trading name">
            <input
              type="text"
              value={tradingName}
              onChange={(e) => setTradingName(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="VAT number">
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Company registration #">
            <input
              type="text"
              value={companyReg}
              onChange={(e) => setCompanyReg(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Billing address" className="sm:col-span-2">
            <input
              type="text"
              value={addr1}
              onChange={(e) => setAddr1(e.target.value)}
              placeholder="Street address"
              className="input"
            />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <input
              type="text"
              value={addr2}
              onChange={(e) => setAddr2(e.target.value)}
              placeholder="Suite, unit, etc."
              className="input"
            />
          </Field>
          <Field label="City">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Postcode">
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Country code" hint="2 letters, e.g. ZA.">
            <input
              type="text"
              value={country}
              onChange={(e) =>
                setCountry(e.target.value.toUpperCase().slice(0, 2))
              }
              className="input"
              maxLength={2}
            />
          </Field>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onSaveBusiness}
            disabled={businessPending}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent disabled:opacity-60"
          >
            {businessPending ? "Saving…" : "Save business details"}
          </button>
        </div>
      </section>

      {/* Continue */}
      <div className="flex justify-end border-t border-brand-line pt-5">
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasAccount}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          Continue
        </button>
      </div>

      {/* Global input style for this step */}
      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 6px;
          border: 1px solid var(--brand-line, #dceae0);
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        :global(.input:focus) {
          border-color: #10b981;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-1 font-display text-[12.5px] font-semibold text-brand-ink">
        {label}
      </div>
      {hint ? (
        <div className="mb-1.5 text-[10.5px] text-brand-mute">{hint}</div>
      ) : null}
      {children}
    </label>
  );
}
