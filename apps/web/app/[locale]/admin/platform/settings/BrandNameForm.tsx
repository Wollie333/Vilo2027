"use client";

import { Loader2, Save, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveBrandingAction } from "./actions";

export function BrandingForm({
  brandName: initialBrand,
  companyName: initialCompany,
  companyLocation: initialLocation,
}: {
  brandName: string;
  companyName: string;
  companyLocation: string;
}) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(initialBrand);
  const [companyName, setCompanyName] = useState(initialCompany);
  const [companyLocation, setCompanyLocation] = useState(initialLocation);
  const [pending, start] = useTransition();

  const dirty =
    brandName.trim() !== initialBrand.trim() ||
    companyName.trim() !== initialCompany.trim() ||
    companyLocation.trim() !== initialLocation.trim();
  const valid = brandName.trim().length > 0 && companyName.trim().length > 0;

  function save() {
    if (pending || !dirty || !valid) return;
    start(async () => {
      try {
        await saveBrandingAction({
          brandName: brandName.trim(),
          companyName: companyName.trim(),
          companyLocation: companyLocation.trim(),
        });
        toast.success("Branding saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="max-w-lg rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-base font-bold text-brand-ink">
          Brand &amp; company
        </h2>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        Placeholders until the real brand and company are registered. Changing
        these updates the name across the whole app — navigation, page titles,
        footers, and the legal pages.
      </p>

      <div className="mt-4 space-y-4">
        <Field
          label="Brand name"
          hint="Shown in nav, page titles, emails (e.g. “Wielo”)."
        >
          <input
            type="text"
            value={brandName}
            maxLength={40}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Wielo"
            className={inputCls}
          />
        </Field>
        <Field
          label="Registered company name"
          hint="Legal entity in copyright + terms/privacy (e.g. “Wielo Platform (Pty) Ltd”)."
        >
          <input
            type="text"
            value={companyName}
            maxLength={120}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Wielo Platform (Pty) Ltd"
            className={inputCls}
          />
        </Field>
        <Field
          label="Company location"
          hint="Shown beside the legal name in footers."
        >
          <input
            type="text"
            value={companyLocation}
            maxLength={120}
            onChange={(e) => setCompanyLocation(e.target.value)}
            placeholder="Cape Town, South Africa"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty || !valid}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
      <span className="mt-1 block text-[11px] text-brand-mute">{hint}</span>
    </label>
  );
}
