"use client";

import {
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  SA_BANKS,
} from "../../settings/banking/schemas";
import {
  archiveBankAccountAction,
  createBankAccountAction,
  saveBusinessDetailsAction,
  setDefaultBankAccountAction,
  updateBankAccountAction,
} from "../../settings/banking/actions";
import type { BankAccount, BusinessDetails } from "../types";

type Props = {
  hostId: string;
  bankAccounts: BankAccount[];
  businessDetails: BusinessDetails | null;
  onAccountSaved: (acc: BankAccount) => void;
  onAccountUpdated: (id: string, patch: Partial<BankAccount>) => void;
  onAccountDeleted: (id: string) => void;
  onDefaultChanged: (id: string) => void;
  onBusinessSaved: (b: BusinessDetails) => void;
  onContinue: () => void;
};

export function StepBanking({
  bankAccounts,
  businessDetails,
  onAccountSaved,
  onAccountUpdated,
  onAccountDeleted,
  onDefaultChanged,
  onBusinessSaved,
  onContinue,
}: Props) {
  const hasAccount = bankAccounts.length > 0;
  // Card / form state. When editingAccountId is set, that card swaps for an
  // edit form. When showAddForm is true, an empty create form is appended
  // to the list. Empty state forces the create form open by default.
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(!hasAccount);

  // Business details card / edit state. When no record exists at all we
  // skip the card and just show the form.
  const businessHasValues = Boolean(
    businessDetails &&
    (businessDetails.legal_name ||
      businessDetails.trading_name ||
      businessDetails.vat_number ||
      businessDetails.company_registration_number ||
      businessDetails.billing_address_line1),
  );
  const [editingBusiness, setEditingBusiness] = useState(!businessHasValues);

  return (
    <div className="space-y-8">
      {/* ─── Bank accounts ─────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Where should we pay you?
            </h3>
            <p className="text-xs text-brand-mute">
              South African EFT only for now — Paystack and PayPal connect from
              Settings once you&rsquo;ve made your first booking. You can add
              multiple accounts; one is always the default.
            </p>
          </div>
        </div>

        {hasAccount ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {bankAccounts.map((a) =>
              editingAccountId === a.id ? (
                <BankAccountForm
                  key={a.id}
                  mode="edit"
                  account={a}
                  onCancel={() => setEditingAccountId(null)}
                  onSaved={(patch) => {
                    onAccountUpdated(a.id, patch);
                    setEditingAccountId(null);
                  }}
                />
              ) : (
                <BankAccountCard
                  key={a.id}
                  account={a}
                  onEdit={() => setEditingAccountId(a.id)}
                  onDelete={async () => {
                    const result = await archiveBankAccountAction(a.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    onAccountDeleted(a.id);
                    toast.success("Account removed.");
                  }}
                  onSetDefault={async () => {
                    const result = await setDefaultBankAccountAction(a.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    onDefaultChanged(a.id);
                    toast.success(`${a.label || a.bank_name} is now default.`);
                  }}
                />
              ),
            )}
          </div>
        ) : null}

        {showAddForm ? (
          <div className={hasAccount ? "mt-3" : ""}>
            <BankAccountForm
              mode="create"
              onCancel={hasAccount ? () => setShowAddForm(false) : undefined}
              onSaved={(acc) => {
                onAccountSaved(acc);
                setShowAddForm(false);
              }}
            />
          </div>
        ) : (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add another bank account
            </button>
          </div>
        )}
      </section>

      {/* ─── Business details ──────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Business details
            </h3>
            <p className="text-xs text-brand-mute">
              Optional — needed if you want VAT invoices for your guests, or
              you&rsquo;re trading under a registered company.
            </p>
          </div>
        </div>

        {businessHasValues && !editingBusiness ? (
          <BusinessDetailsCard
            details={businessDetails!}
            onEdit={() => setEditingBusiness(true)}
          />
        ) : (
          <BusinessDetailsForm
            defaults={businessDetails}
            canCancel={businessHasValues}
            onCancel={() => setEditingBusiness(false)}
            onSaved={(b) => {
              onBusinessSaved(b);
              setEditingBusiness(false);
            }}
          />
        )}
      </section>

      {/* ─── Continue ─────────────────────────────────────────── */}
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
    </div>
  );
}

// ─── Saved bank-account card ───────────────────────────────────

function BankAccountCard({
  account,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  account: BankAccount;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const [deletePending, startDelete] = useTransition();
  const [defaultPending, startDefault] = useTransition();
  const [revealed, setRevealed] = useState(false);

  const digits = account.account_number.replace(/\s/g, "");
  const maskedNumber =
    digits.length > 4
      ? `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
      : digits || "—";

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Landmark className="h-3.5 w-3.5 shrink-0 text-brand-mute" />
          <span className="truncate font-display text-[13px] font-semibold text-brand-ink">
            {account.label || account.bank_name}
          </span>
          {account.is_default ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <ShieldCheck className="h-2.5 w-2.5" strokeWidth={3} />
              Default
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit account"
            title="Edit"
            className="flex h-7 w-7 items-center justify-center rounded text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => startDelete(onDelete)}
            disabled={deletePending}
            aria-label="Delete account"
            title={
              account.is_default
                ? "Set another account as default first"
                : "Delete"
            }
            className="flex h-7 w-7 items-center justify-center rounded text-brand-mute transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Full details, so the host can eyeball them before editing. The
          account number is masked until the eye toggle reveals it. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5">
        <DetailRow label="Account holder" value={account.account_holder} />
        <DetailRow
          label="Bank"
          value={`${account.bank_name} · ${
            ACCOUNT_TYPE_LABELS[
              account.account_type as keyof typeof ACCOUNT_TYPE_LABELS
            ] ?? account.account_type
          }`}
        />
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Account number
          </dt>
          <dd className="mt-0.5 flex items-center gap-2">
            <span className="num font-mono text-[13px] font-medium text-brand-ink">
              {revealed ? account.account_number || "—" : maskedNumber}
            </span>
            {digits.length > 0 ? (
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-label={
                  revealed ? "Hide account number" : "Reveal account number"
                }
                aria-pressed={revealed}
                className="flex h-6 w-6 items-center justify-center rounded text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
              >
                {revealed ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
          </dd>
        </div>
        <DetailRow
          label="Branch code"
          value={account.branch_code || "—"}
          mono
        />
        <DetailRow label="SWIFT / BIC" value={account.swift_code || "—"} mono />
      </dl>

      {!account.is_default ? (
        <div className="border-t border-brand-line px-4 py-2">
          <button
            type="button"
            onClick={() => startDefault(onSetDefault)}
            disabled={defaultPending}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-primary transition hover:underline disabled:opacity-50"
          >
            <ShieldCheck className="h-3 w-3" />
            {defaultPending ? "Setting…" : "Set as default"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd
        className={`mt-0.5 truncate text-[13px] font-medium text-brand-ink ${
          mono ? "num font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// ─── Bank-account form (create + edit) ─────────────────────────

function BankAccountForm({
  mode,
  account,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  account?: BankAccount;
  onSaved: (acc: BankAccount) => void;
  onCancel?: () => void;
}) {
  const [label, setLabel] = useState(account?.label ?? "Main account");
  // On edit we don't know the prior bank_select (Other vs named). If
  // bank_name matches one of SA_BANKS we use that; otherwise default to
  // "Other" with the bank_name copied in.
  const initialBankSelect: (typeof SA_BANKS)[number] =
    mode === "edit" && account
      ? (SA_BANKS as readonly string[]).includes(account.bank_name)
        ? (account.bank_name as (typeof SA_BANKS)[number])
        : "Other"
      : "FNB";
  const initialBankNameOther =
    mode === "edit" &&
    account &&
    !(SA_BANKS as readonly string[]).includes(account.bank_name)
      ? account.bank_name
      : "";
  const [bankSelect, setBankSelect] =
    useState<(typeof SA_BANKS)[number]>(initialBankSelect);
  const [bankNameOther, setBankNameOther] = useState(initialBankNameOther);
  const [accountHolder, setAccountHolder] = useState(
    account?.account_holder ?? "",
  );
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<
    (typeof ACCOUNT_TYPES)[number]
  >((account?.account_type as (typeof ACCOUNT_TYPES)[number]) ?? "cheque");
  const [branchCode, setBranchCode] = useState(account?.branch_code ?? "");
  const [swiftCode, setSwiftCode] = useState(account?.swift_code ?? "");
  const [referenceFormat, setReferenceFormat] = useState("Guest surname");
  const [isDefault, setIsDefault] = useState(account?.is_default ?? false);

  const [pending, start] = useTransition();

  function validate(): string | null {
    if (!label.trim()) return "Give this account a label.";
    if (bankSelect === "Other" && !bankNameOther.trim())
      return "Enter the bank name.";
    if (accountHolder.trim().length < 2)
      return "Enter the account holder name (at least 2 characters).";
    // Account number is required on create; on edit, empty means "keep
    // the existing stored value" (the server respects that).
    if (mode === "create") {
      if (!/^\d{6,16}$/.test(accountNumber.trim()))
        return "Account number must be 6 to 16 digits.";
    } else if (accountNumber && !/^\d{6,16}$/.test(accountNumber.trim())) {
      return "Account number must be 6 to 16 digits, or blank to keep the existing one.";
    }
    if (!/^\d{6}$/.test(branchCode.trim()))
      return "Branch code must be exactly 6 digits.";
    if (swiftCode.trim() && swiftCode.trim().length > 11)
      return "SWIFT / BIC is at most 11 characters.";
    if (!referenceFormat.trim()) return "Reference format is required.";
    return null;
  }

  function submit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    start(async () => {
      const payload = {
        label: label.trim(),
        bank_select: bankSelect,
        bank_name_other: bankNameOther.trim(),
        account_holder: accountHolder.trim(),
        account_number: accountNumber.trim(),
        account_type: accountType,
        branch_code: branchCode.trim(),
        swift_code: swiftCode.trim(),
        reference_format: referenceFormat.trim(),
        is_default: mode === "create" ? true : isDefault,
      };
      const result =
        mode === "create"
          ? await createBankAccountAction(payload)
          : await updateBankAccountAction(account!.id, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const resolvedBankName =
        bankSelect === "Other" ? bankNameOther.trim() : bankSelect;
      const acc: BankAccount = {
        id: account?.id ?? `temp-${Date.now()}`,
        label: label.trim(),
        bank_name: resolvedBankName,
        account_holder: accountHolder.trim(),
        // On edit a blank number means "keep existing" — preserve the prior
        // full value so the card still shows it; otherwise use what was typed.
        account_number: accountNumber.trim()
          ? accountNumber.trim()
          : (account?.account_number ?? ""),
        branch_code: branchCode.trim(),
        swift_code: swiftCode.trim(),
        account_type: accountType,
        is_default: payload.is_default,
      };
      onSaved(acc);
      toast.success(
        mode === "create" ? "Bank account saved." : "Bank account updated.",
      );
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Landmark className="h-3.5 w-3.5 text-brand-mute" />
          <span className="font-display text-[13px] font-semibold text-brand-ink">
            {mode === "create" ? "Add a bank account" : "Edit bank account"}
          </span>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-7 w-7 items-center justify-center rounded text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="text-input"
            />
          </Field>
          <Field label="Bank">
            <select
              value={bankSelect}
              onChange={(e) =>
                setBankSelect(e.target.value as (typeof SA_BANKS)[number])
              }
              className="text-input"
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
                className="text-input"
              />
            </Field>
          ) : null}
          <Field label="Account holder" className="sm:col-span-2">
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="As it appears on the account"
              className="text-input"
            />
          </Field>
          <Field
            label="Account number"
            hint={
              mode === "edit"
                ? "Leave blank to keep the current number."
                : undefined
            }
          >
            <input
              type="text"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, ""))
              }
              placeholder={
                mode === "edit" && account
                  ? `current: ••••${account.account_number.replace(/\s/g, "").slice(-4)}`
                  : "6–16 digits"
              }
              className="text-input"
            />
          </Field>
          <Field label="Account type">
            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as (typeof ACCOUNT_TYPES)[number])
              }
              className="text-input"
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
              className="text-input"
            />
          </Field>
          <Field label="SWIFT / BIC" hint="Optional — for foreign payers.">
            <input
              type="text"
              value={swiftCode}
              onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
              placeholder="e.g. FIRNZAJJ"
              className="text-input"
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
              className="text-input"
            />
          </Field>
        </div>

        {mode === "edit" ? (
          <label className="flex items-center gap-2 text-xs text-brand-ink">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-brand-line"
            />
            Make this the default account
          </label>
        ) : null}

        <div className="flex items-center gap-2 text-[11px] text-brand-mute">
          <Lock className="h-3 w-3" />
          {mode === "create"
            ? "Stored securely. Only the last 4 digits are visible after save."
            : "Only the last 4 digits are ever shown after save."}
        </div>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Save bank account"
                : "Save changes"}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.text-input) {
          width: 100%;
          border-radius: 6px;
          border: 1px solid #dceae0;
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        :global(.text-input:focus) {
          border-color: #10b981;
        }
      `}</style>
    </div>
  );
}

// ─── Business details — card + form ────────────────────────────

function BusinessDetailsCard({
  details,
  onEdit,
}: {
  details: BusinessDetails;
  onEdit: () => void;
}) {
  const headline =
    details.trading_name || details.legal_name || "Business details";
  const subline =
    details.trading_name && details.legal_name
      ? `Legally ${details.legal_name}`
      : null;
  const addressLine = [
    details.billing_address_line1,
    details.billing_address_line2,
    details.billing_city,
    details.billing_postcode,
    details.billing_country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-mute" />
          <span className="truncate font-display text-[13px] font-semibold text-brand-ink">
            {headline}
          </span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit business details"
          title="Edit"
          className="flex h-7 w-7 items-center justify-center rounded text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <dl className="grid gap-2 px-4 py-3.5 text-[12px] sm:grid-cols-2">
        {subline ? <Row label="Legal name" value={details.legal_name} /> : null}
        {details.vat_number ? (
          <Row label="VAT number" value={details.vat_number} mono />
        ) : null}
        {details.company_registration_number ? (
          <Row
            label="Company reg #"
            value={details.company_registration_number}
            mono
          />
        ) : null}
        {addressLine ? (
          <Row
            label="Billing address"
            value={addressLine}
            className="sm:col-span-2"
          />
        ) : null}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <dt className="text-[10.5px] uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd
        className={`text-brand-ink ${mono ? "font-mono text-[12px]" : "text-[13px]"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function BusinessDetailsForm({
  defaults,
  canCancel,
  onCancel,
  onSaved,
}: {
  defaults: BusinessDetails | null;
  canCancel: boolean;
  onCancel: () => void;
  onSaved: (b: BusinessDetails) => void;
}) {
  const [legalName, setLegalName] = useState(defaults?.legal_name ?? "");
  const [tradingName, setTradingName] = useState(defaults?.trading_name ?? "");
  const [vatNumber, setVatNumber] = useState(defaults?.vat_number ?? "");
  const [companyReg, setCompanyReg] = useState(
    defaults?.company_registration_number ?? "",
  );
  const [addr1, setAddr1] = useState(defaults?.billing_address_line1 ?? "");
  const [addr2, setAddr2] = useState(defaults?.billing_address_line2 ?? "");
  const [city, setCity] = useState(defaults?.billing_city ?? "");
  const [postcode, setPostcode] = useState(defaults?.billing_postcode ?? "");
  const [country, setCountry] = useState(defaults?.billing_country ?? "ZA");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const next: BusinessDetails = {
        legal_name: legalName.trim(),
        trading_name: tradingName.trim(),
        vat_number: vatNumber.trim(),
        company_registration_number: companyReg.trim(),
        billing_address_line1: addr1.trim(),
        billing_address_line2: addr2.trim(),
        billing_city: city.trim(),
        billing_postcode: postcode.trim(),
        billing_country: country.trim().toUpperCase().slice(0, 2),
      };
      const result = await saveBusinessDetailsAction(next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved(next);
      toast.success("Business details saved.");
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-brand-mute" />
          <span className="font-display text-[13px] font-semibold text-brand-ink">
            {defaults ? "Edit business details" : "Add business details"}
          </span>
        </div>
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-7 w-7 items-center justify-center rounded text-brand-mute transition hover:bg-brand-accent hover:text-brand-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name">
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="text-input"
            />
          </Field>
          <Field label="Trading name">
            <input
              type="text"
              value={tradingName}
              onChange={(e) => setTradingName(e.target.value)}
              className="text-input"
            />
          </Field>
          <Field label="VAT number">
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="text-input"
            />
          </Field>
          <Field label="Company registration #">
            <input
              type="text"
              value={companyReg}
              onChange={(e) => setCompanyReg(e.target.value)}
              className="text-input"
            />
          </Field>
          <Field label="Billing address" className="sm:col-span-2">
            <input
              type="text"
              value={addr1}
              onChange={(e) => setAddr1(e.target.value)}
              placeholder="Street address"
              className="text-input"
            />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <input
              type="text"
              value={addr2}
              onChange={(e) => setAddr2(e.target.value)}
              placeholder="Suite, unit, etc."
              className="text-input"
            />
          </Field>
          <Field label="City">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="text-input"
            />
          </Field>
          <Field label="Postcode">
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="text-input"
            />
          </Field>
          <Field label="Country code" hint="2 letters, e.g. ZA.">
            <input
              type="text"
              value={country}
              onChange={(e) =>
                setCountry(e.target.value.toUpperCase().slice(0, 2))
              }
              maxLength={2}
              className="text-input"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          {canCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save business details"}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.text-input) {
          width: 100%;
          border-radius: 6px;
          border: 1px solid #dceae0;
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        :global(.text-input:focus) {
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
      <div className="mb-1 font-display text-[12px] font-semibold text-brand-ink">
        {label}
      </div>
      {hint ? (
        <div className="mb-1.5 text-[10.5px] text-brand-mute">{hint}</div>
      ) : null}
      {children}
    </label>
  );
}
