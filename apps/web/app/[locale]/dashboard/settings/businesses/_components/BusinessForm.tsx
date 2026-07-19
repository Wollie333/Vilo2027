"use client";

import { ArrowLeft, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Field,
  SelectInput,
  TextInput,
} from "@/app/[locale]/dashboard/setup/_atoms";
import { Link, useRouter } from "@/i18n/navigation";
import { CURRENCY_META, DISPLAY_CURRENCIES } from "@/lib/currency";

import { createBusinessAction, updateBusinessAction } from "../actions";
import {
  BUSINESS_LOCALE_LABELS,
  BUSINESS_LOCALES,
  businessProfileSchema,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "../schemas";
import {
  AddressFields,
  EMPTY_ADDRESS,
  type AddressValue,
} from "./AddressFields";
import { BusinessLogoUploader } from "./BusinessLogoUploader";

export type BusinessFormValues = {
  trading_name: string;
  legal_name: string;
  vat_number: string;
  company_registration_number: string;
  default_currency: string;
  default_language: string;
  website_url: string;
  social_links: Record<SocialPlatform, string>;
} & AddressValue;

export const EMPTY_SOCIALS: Record<SocialPlatform, string> = {
  instagram: "",
  facebook: "",
  x: "",
  tiktok: "",
  youtube: "",
  linkedin: "",
};

export const EMPTY_BUSINESS: BusinessFormValues = {
  trading_name: "",
  legal_name: "",
  vat_number: "",
  company_registration_number: "",
  default_currency: "ZAR",
  default_language: "en",
  website_url: "",
  social_links: { ...EMPTY_SOCIALS },
  ...EMPTY_ADDRESS,
};

export function BusinessForm({
  mode,
  businessId,
  initial,
  logoUrl,
}: {
  mode: "create" | "edit";
  businessId?: string;
  initial: BusinessFormValues;
  logoUrl?: string | null;
}) {
  const t = useTranslations("businesses");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<BusinessFormValues>(initial);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof BusinessFormValues>(
    key: K,
    value: BusinessFormValues[K],
  ) {
    setV((prev) => ({ ...prev, [key]: value }));
  }
  function patchAddress(patch: Partial<AddressValue>) {
    setV((prev) => ({ ...prev, ...patch }));
  }
  function setSocial(key: SocialPlatform, value: string) {
    setV((prev) => ({
      ...prev,
      social_links: { ...prev.social_links, [key]: value },
    }));
  }

  function submit() {
    const parsed = businessProfileSchema.safeParse({
      ...v,
      latitude: v.latitude,
      longitude: v.longitude,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check the form.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError(null);
    start(async () => {
      const res =
        mode === "edit" && businessId
          ? await updateBusinessAction(businessId, parsed.data)
          : await createBusinessAction(parsed.data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "edit" ? t("saved") : t("created"));
      router.push("/dashboard/settings/businesses");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings/businesses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-mute transition hover:text-brand-ink"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToList")}
      </Link>

      <h2 className="font-display text-lg font-bold text-brand-ink">
        {mode === "edit" ? t("editTitle") : t("newTitle")}
      </h2>

      {/* Identity */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h3 className="mb-4 font-display text-base font-semibold text-brand-ink">
          {t("sectionIdentity")}
        </h3>
        <div className="space-y-4">
          <Field label={t("fieldTradingName")} required>
            <TextInput
              value={v.trading_name}
              onChange={(e) => set("trading_name", e.target.value)}
              placeholder="Karoo Cottages"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fieldLegalName")} optional>
              <TextInput
                value={v.legal_name}
                onChange={(e) => set("legal_name", e.target.value)}
                placeholder="Karoo Cottages (Pty) Ltd"
              />
            </Field>
            <Field label={t("fieldVat")} optional>
              <TextInput
                value={v.vat_number}
                onChange={(e) => set("vat_number", e.target.value)}
                placeholder="4123456789"
              />
            </Field>
          </div>
          <Field label={t("fieldReg")} optional>
            <TextInput
              value={v.company_registration_number}
              onChange={(e) =>
                set("company_registration_number", e.target.value)
              }
              placeholder="2023/123456/07"
            />
          </Field>
        </div>
      </section>

      {/* Currency & language */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h3 className="mb-4 font-display text-base font-semibold text-brand-ink">
          {t("sectionPreferences")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fieldCurrency")} hint={t("currencyHint")}>
            <SelectInput
              value={v.default_currency}
              onChange={(e) => set("default_currency", e.target.value)}
            >
              {DISPLAY_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} · {CURRENCY_META[c].label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t("fieldLanguage")} hint={t("languageHint")}>
            <SelectInput
              value={v.default_language}
              onChange={(e) => set("default_language", e.target.value)}
            >
              {BUSINESS_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {BUSINESS_LOCALE_LABELS[l]}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </section>

      {/* Address */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h3 className="mb-4 font-display text-base font-semibold text-brand-ink">
          {t("sectionAddress")}
        </h3>
        <AddressFields
          value={{
            address_line1: v.address_line1,
            address_line2: v.address_line2,
            city: v.city,
            municipality: v.municipality,
            province: v.province,
            postal_code: v.postal_code,
            country: v.country,
            latitude: v.latitude,
            longitude: v.longitude,
          }}
          onChange={patchAddress}
        />
      </section>

      {/* Web & social — the business's guest-facing web presence. Shown to
          guests on their booking's host card. */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h3 className="mb-1 font-display text-base font-semibold text-brand-ink">
          Website &amp; social
        </h3>
        <p className="mb-4 text-sm text-brand-mute">
          Optional. Shown to guests on their booking so they can find you
          online.
        </p>
        <div className="space-y-4">
          <Field label="Website" optional>
            <TextInput
              type="url"
              inputMode="url"
              value={v.website_url}
              onChange={(e) => set("website_url", e.target.value)}
              placeholder="https://your-business.com"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((p) => (
              <Field key={p.key} label={p.label} optional>
                <TextInput
                  value={v.social_links[p.key] ?? ""}
                  onChange={(e) => setSocial(p.key, e.target.value)}
                  placeholder={p.placeholder}
                />
              </Field>
            ))}
          </div>
        </div>
      </section>

      {/* Logo (edit only — needs a saved business to attach to) */}
      {mode === "edit" && businessId ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h3 className="mb-4 font-display text-base font-semibold text-brand-ink">
            {t("sectionLogo")}
          </h3>
          <BusinessLogoUploader
            businessId={businessId}
            initialUrl={logoUrl ?? null}
          />
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
