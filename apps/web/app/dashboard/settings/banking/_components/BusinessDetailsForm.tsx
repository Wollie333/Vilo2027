"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field, TextInput } from "@/app/dashboard/setup/_atoms";

import { saveBusinessDetailsAction } from "../actions";
import { businessDetailsSchema, type BusinessDetailsInput } from "../schemas";
import { LogoUploader } from "./LogoUploader";

export function BusinessDetailsForm({
  defaults,
  logoUrl,
  onSaved,
}: {
  defaults: BusinessDetailsInput;
  logoUrl?: string | null;
  onSaved?: () => void;
}) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<BusinessDetailsInput>(defaults);
  // Collapse to a read-only summary once anything has been captured.
  const hasData = Boolean(
    saved.legal_name ||
    saved.trading_name ||
    saved.vat_number ||
    saved.company_registration_number ||
    saved.billing_address_line1 ||
    saved.billing_city,
  );
  const [editing, setEditing] = useState(!hasData);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessDetailsInput>({
    resolver: zodResolver(businessDetailsSchema),
    defaultValues: defaults,
  });

  function onSubmit(values: BusinessDetailsInput) {
    start(async () => {
      const result = await saveBusinessDetailsAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Business details saved.");
      setSaved(values);
      setEditing(false);
      onSaved?.();
    });
  }

  const addressLine = [
    saved.billing_address_line1,
    saved.billing_address_line2,
    saved.billing_city,
    saved.billing_postcode,
    saved.billing_country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
            <Building2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Business details
            </h3>
            <p className="mt-0.5 text-xs text-brand-mute">
              Printed on invoices &amp; quotes. Leave blank if you trade as an
              individual.
            </p>
          </div>
        </div>
        {!editing && hasData ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-accent"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        ) : null}
      </div>

      {/* Logo — branded onto every financial document. */}
      <div className="border-b border-brand-line px-5 py-4">
        <LogoUploader initialUrl={logoUrl ?? null} />
      </div>

      {/* Saved summary */}
      {!editing && hasData ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
          <SavedRow label="Legal name" value={saved.legal_name} />
          <SavedRow label="Trading as" value={saved.trading_name} />
          <SavedRow label="VAT number" value={saved.vat_number} mono />
          <SavedRow
            label="Company reg #"
            value={saved.company_registration_number}
            mono
          />
          <SavedRow
            label="Billing address"
            value={addressLine}
            className="sm:col-span-2"
          />
        </dl>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 px-5 py-5"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Legal name"
              optional
              error={errors.legal_name?.message}
            >
              <TextInput
                placeholder="Karoo Cottages (Pty) Ltd"
                {...register("legal_name")}
              />
            </Field>
            <Field
              label="Trading as"
              optional
              error={errors.trading_name?.message}
            >
              <TextInput
                placeholder="Karoo Cottages"
                {...register("trading_name")}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="VAT number"
              optional
              error={errors.vat_number?.message}
            >
              <TextInput placeholder="4123456789" {...register("vat_number")} />
            </Field>
            <Field
              label="Company registration #"
              optional
              error={errors.company_registration_number?.message}
            >
              <TextInput
                placeholder="2023/123456/07"
                {...register("company_registration_number")}
              />
            </Field>
          </div>

          <Field label="Address line 1" optional>
            <TextInput
              placeholder="42 Long Street"
              {...register("billing_address_line1")}
            />
          </Field>
          <Field label="Address line 2" optional>
            <TextInput
              placeholder="Suite 4B"
              {...register("billing_address_line2")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City" optional>
              <TextInput
                placeholder="Cape Town"
                {...register("billing_city")}
              />
            </Field>
            <Field label="Postcode" optional>
              <TextInput placeholder="8001" {...register("billing_postcode")} />
            </Field>
            <Field label="Country" optional hint="ISO 2-letter code.">
              <TextInput
                maxLength={2}
                placeholder="ZA"
                {...register("billing_country")}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {hasData ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-brand-line bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition hover:bg-brand-light"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save business details"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SavedRow({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-[13px] font-medium text-brand-ink ${mono ? "num font-mono" : ""}`}
      >
        {value && value.length > 0 ? value : "—"}
      </dd>
    </div>
  );
}
