"use client";

import { Building2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { WieloBusinessProfile } from "@/lib/billing/wielo-invoice";

import { saveWieloBusinessAction } from "./actions";

type Field = keyof WieloBusinessProfile;

const FIELDS: {
  key: Field;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: "legal_name",
    label: "Registered company name",
    hint: "The legal entity that issues Wielo invoices.",
    placeholder: "Wielo Platform (Pty) Ltd",
  },
  {
    key: "vat_number",
    label: "VAT number",
    hint: "When set, invoices split out 15% VAT and read “Tax Invoice”.",
    placeholder: "4123456789",
  },
  {
    key: "company_reg_number",
    label: "Company registration number",
    hint: "CIPC registration number.",
    placeholder: "2026/123456/07",
  },
  {
    key: "address_line1",
    label: "Address line 1",
    hint: "Street / building.",
    placeholder: "1 Long Street",
  },
  {
    key: "address_line2",
    label: "Address line 2",
    hint: "Suburb / unit (optional).",
    placeholder: "City Centre",
  },
  { key: "city", label: "City", hint: "", placeholder: "Cape Town" },
  {
    key: "postal_code",
    label: "Postal code",
    hint: "",
    placeholder: "8001",
  },
  {
    key: "country",
    label: "Country code",
    hint: "Two-letter ISO code. Defaults to ZA.",
    placeholder: "ZA",
  },
  {
    key: "email",
    label: "Billing email",
    hint: "Shown on the invoice for billing queries.",
    placeholder: "billing@wielo.co.za",
  },
];

export function WieloBusinessForm({
  initial,
}: {
  initial: WieloBusinessProfile;
}) {
  const router = useRouter();
  const [values, setValues] = useState<WieloBusinessProfile>(initial);
  const [pending, start] = useTransition();

  const dirty = (Object.keys(values) as Field[]).some(
    (k) => (values[k] ?? "").trim() !== (initial[k] ?? "").trim(),
  );

  function set(key: Field, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      try {
        await saveWieloBusinessAction({
          legal_name: values.legal_name.trim(),
          vat_number: values.vat_number.trim(),
          company_reg_number: values.company_reg_number.trim(),
          address_line1: values.address_line1.trim(),
          address_line2: values.address_line2.trim(),
          city: values.city.trim(),
          postal_code: values.postal_code.trim(),
          country: values.country.trim().toUpperCase(),
          email: values.email.trim(),
          logo_path: values.logo_path.trim(),
        });
        toast.success("Wielo business details saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="max-w-lg rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-base font-bold text-brand-ink">
          Wielo business details
        </h2>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        The issuer on every invoice Wielo sends for subscriptions and products —
        the platform equivalent of a host&apos;s business details. Frozen onto
        each invoice at the moment it&apos;s issued.
      </p>

      <div className="mt-4 space-y-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              {f.label}
            </span>
            <input
              type="text"
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={inputCls}
            />
            {f.hint ? (
              <span className="mt-1 block text-[11px] text-brand-mute">
                {f.hint}
              </span>
            ) : null}
          </label>
        ))}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";
