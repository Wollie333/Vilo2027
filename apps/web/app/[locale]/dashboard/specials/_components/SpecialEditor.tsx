"use client";

import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import {
  SPECIAL_CATEGORIES,
  type SpecialCategoryKey,
} from "@/lib/specials/categories";

import { createSpecialAction, updateSpecialAction } from "../actions";
import type { SpecialEditorData } from "../_lib/load";
import type { SpecialEditorStatus, SpecialInput } from "../schemas";
import {
  DateField,
  Field,
  HeroImageField,
  NumberField,
  SegmentField,
  SelectField,
  TagInput,
  TextArea,
  TextField,
  ToggleField,
} from "./fields";

export function SpecialEditor({
  mode,
  specialId,
  initialValues,
  initialStatus,
  data,
}: {
  mode: "create" | "edit";
  specialId?: string;
  initialValues: SpecialInput;
  initialStatus: SpecialInput["status"];
  data: SpecialEditorData;
}) {
  const t = useTranslations("specials");
  const router = useRouter();
  const [form, setForm] = useState<SpecialInput>(initialValues);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof SpecialInput>(key: K, value: SpecialInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedProperty = useMemo(
    () => data.properties.find((p) => p.id === form.property_id) ?? null,
    [data.properties, form.property_id],
  );
  const currency = selectedProperty?.currency ?? "ZAR";
  const websiteId = selectedProperty
    ? data.websiteByBusiness[selectedProperty.businessId]
    : undefined;

  function onPickProperty(propertyId: string) {
    const prop = data.properties.find((p) => p.id === propertyId) ?? null;
    setForm((f) => {
      const roomStillValid =
        f.room_id != null && !!prop?.rooms.some((r) => r.id === f.room_id);
      return {
        ...f,
        property_id: propertyId,
        room_id: roomStillValid ? f.room_id : null,
      };
    });
  }

  function toggleCategory(key: SpecialCategoryKey) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(key)
        ? f.categories.filter((c) => c !== key)
        : [...f.categories, key],
    }));
  }

  function toggleAddon(addonId: string) {
    setForm((f) => {
      const exists = f.addons.some((a) => a.addon_id === addonId);
      return {
        ...f,
        addons: exists
          ? f.addons.filter((a) => a.addon_id !== addonId)
          : [
              ...f.addons,
              {
                addon_id: addonId,
                is_required: false,
                unit_price_override: null,
              },
            ],
      };
    });
  }

  function patchAddon(
    addonId: string,
    patch: Partial<SpecialInput["addons"][number]>,
  ) {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((a) =>
        a.addon_id === addonId ? { ...a, ...patch } : a,
      ),
    }));
  }

  function submit(status: SpecialEditorStatus) {
    if (!form.property_id) {
      toast.error(t("pickPropertyFirst"));
      return;
    }
    const payload: SpecialInput = { ...form, status };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createSpecialAction(payload)
          : await updateSpecialAction(specialId as string, payload);
      if (res.ok) {
        toast.success(mode === "create" ? t("toastCreated") : t("toastSaved"));
        router.push("/dashboard/specials");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const linkOnly = !form.show_in_directory && !form.show_on_website;
  const propertyOptions = [
    { value: "", label: t("optSelectProperty") },
    ...data.properties.map((p) => ({ value: p.id, label: p.name })),
  ];
  const roomOptions = [
    { value: "", label: t("optWholeProperty") },
    ...(selectedProperty?.rooms ?? []).map((r) => ({
      value: r.id,
      label: r.name,
    })),
  ];
  const policyOptions = [
    { value: "", label: t("optInheritPolicy") },
    ...data.policies.map((p) => ({ value: p.id, label: p.name })),
  ];

  if (data.properties.length === 0) {
    return <EmptyProperties />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/specials"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute transition-colors hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToList")}
        </Link>
        <span className="rounded-pill bg-brand-light px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {mode === "create"
            ? t("badgeNew")
            : t("badgeEditing", { status: t(`status_${initialStatus}`) })}
        </span>
      </div>

      {/* Target ------------------------------------------------------ */}
      <Section title={t("secTargetTitle")} subtitle={t("secTargetSub")}>
        <SelectField
          label={t("fldProperty")}
          value={form.property_id || ""}
          options={propertyOptions}
          onChange={onPickProperty}
        />
        <SelectField
          label={t("fldRoom")}
          value={form.room_id ?? ""}
          options={roomOptions}
          onChange={(v) => set("room_id", v || null)}
          hint={t("fldRoomHint")}
        />
      </Section>

      {/* Dates ------------------------------------------------------- */}
      <Section title={t("secDatesTitle")} subtitle={t("secDatesSub")}>
        <SegmentField
          label={t("fldDateMode")}
          value={form.date_mode}
          onChange={(v) => set("date_mode", v)}
          options={[
            {
              value: "fixed",
              label: t("dateFixed"),
              hint: t("dateFixedHint"),
            },
            {
              value: "flexible",
              label: t("dateFlexible"),
              hint: t("dateFlexibleHint"),
            },
          ]}
        />
        {form.date_mode === "fixed" ? (
          <div className="grid grid-cols-2 gap-3">
            <DateField
              label={t("fldCheckIn")}
              value={form.fixed_check_in}
              onChange={(v) => set("fixed_check_in", v)}
            />
            <DateField
              label={t("fldCheckOut")}
              value={form.fixed_check_out}
              min={form.fixed_check_in ?? undefined}
              onChange={(v) => set("fixed_check_out", v)}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <DateField
                label={t("fldWindowStart")}
                value={form.window_start}
                onChange={(v) => set("window_start", v)}
              />
              <DateField
                label={t("fldWindowEnd")}
                value={form.window_end}
                min={form.window_start ?? undefined}
                onChange={(v) => set("window_end", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={t("fldMinNights")}
                value={form.min_nights}
                min={1}
                max={365}
                onChange={(v) => set("min_nights", v)}
              />
              <NumberField
                label={t("fldMaxNights")}
                value={form.max_nights}
                min={1}
                max={365}
                onChange={(v) => set("max_nights", v)}
                hint={t("fldMaxNightsHint")}
              />
            </div>
          </>
        )}
      </Section>

      {/* Pricing ----------------------------------------------------- */}
      <Section
        title={t("secPriceTitle")}
        subtitle={t("secPriceSub", { currency })}
      >
        <SegmentField
          label={t("fldPriceMode")}
          value={form.price_mode}
          onChange={(v) => set("price_mode", v)}
          options={[
            {
              value: "flat",
              label: t("priceFlat"),
              hint: t("priceFlatHint"),
            },
            {
              value: "per_night",
              label: t("pricePerNightOpt"),
              hint: t("pricePerNightHint"),
            },
          ]}
        />
        {form.price_mode === "flat" ? (
          <NumberField
            label={t("fldFlatTotal")}
            value={form.flat_total}
            min={0}
            step={0.01}
            prefix={currency}
            onChange={(v) => set("flat_total", v)}
            hint={t("fldFlatTotalHint")}
          />
        ) : (
          <NumberField
            label={t("fldPerNight")}
            value={form.per_night_price}
            min={0}
            step={0.01}
            prefix={currency}
            onChange={(v) => set("per_night_price", v)}
          />
        )}
        <NumberField
          label={t("fldMaxGuests")}
          value={form.max_guests}
          min={1}
          max={100}
          onChange={(v) => set("max_guests", v)}
          hint={t("fldMaxGuestsHint")}
        />
      </Section>

      {/* Inventory + scheduling ------------------------------------- */}
      <Section title={t("secAvailTitle")} subtitle={t("secAvailSub")}>
        <NumberField
          label={t("fldQuantity")}
          value={form.quantity}
          min={1}
          max={100000}
          onChange={(v) => set("quantity", v ?? 1)}
          hint={t("fldQuantityHint")}
        />
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label={t("fldGoLive")}
            value={form.go_live_at}
            onChange={(v) => set("go_live_at", v)}
            hint={t("fldGoLiveHint")}
          />
          <DateField
            label={t("fldBookBy")}
            value={form.book_by}
            onChange={(v) => set("book_by", v)}
            hint={t("fldBookByHint")}
          />
        </div>
      </Section>

      {/* Add-ons ----------------------------------------------------- */}
      <Section title={t("secAddonsTitle")} subtitle={t("secAddonsSub")}>
        {data.addons.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[13px] text-brand-mute">
            {t("addonsEmpty")}
          </p>
        ) : (
          <div className="space-y-2">
            {data.addons.map((addon) => {
              const selected = form.addons.find((a) => a.addon_id === addon.id);
              return (
                <div
                  key={addon.id}
                  className={`rounded-[10px] border p-3 transition ${
                    selected
                      ? "border-brand-primary/40 bg-brand-accent/20"
                      : "border-brand-line bg-white"
                  }`}
                >
                  <label className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleAddon(addon.id)}
                        className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                      />
                      {addon.name}
                    </span>
                    <span className="text-[12px] text-brand-mute">
                      {formatMoney(addon.unitPrice, addon.currency)}
                    </span>
                  </label>
                  {selected ? (
                    <div className="mt-3 grid grid-cols-2 items-end gap-3 border-t border-brand-line/70 pt-3">
                      <ToggleField
                        label={t("fldRequired")}
                        hint={t("fldRequiredHint")}
                        checked={selected.is_required}
                        onChange={(v) =>
                          patchAddon(addon.id, { is_required: v })
                        }
                      />
                      <NumberField
                        label={t("fldPriceOverride")}
                        value={selected.unit_price_override}
                        min={0}
                        step={0.01}
                        prefix={currency}
                        onChange={(v) =>
                          patchAddon(addon.id, { unit_price_override: v })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Merchandising ---------------------------------------------- */}
      <Section title={t("secMerchTitle")} subtitle={t("secMerchSub")}>
        <div>
          <span className="block text-[13px] font-semibold text-brand-ink">
            {t("fldCategories")}
          </span>
          <span className="mt-0.5 block text-[12px] text-brand-mute">
            {t("fldCategoriesHint")}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPECIAL_CATEGORIES.map((c) => {
              const on = form.categories.includes(c.key);
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => toggleCategory(c.key)}
                  className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-medium transition ${
                    on
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line bg-white text-brand-ink hover:border-brand-mute"
                  }`}
                >
                  {t(`category_${c.key}`)}
                </button>
              );
            })}
          </div>
        </div>
        <TagInput
          label={t("fldCustomTags")}
          value={form.custom_tags}
          onChange={(v) => set("custom_tags", v)}
          hint={t("fldCustomTagsHint")}
        />
        <TextField
          label={t("fldBadge")}
          value={form.badge ?? ""}
          onChange={(v) => set("badge", v || null)}
          maxLength={40}
          placeholder={t("fldBadgePlaceholder")}
          hint={t("fldBadgeHint")}
        />
        <ToggleField
          label={t("fldFeatured")}
          hint={t("fldFeaturedHint")}
          checked={form.is_featured}
          onChange={(v) => set("is_featured", v)}
        />
      </Section>

      {/* Presentation ------------------------------------------------ */}
      <Section title={t("secPresentTitle")} subtitle={t("secPresentSub")}>
        <TextField
          label={t("fldTitle")}
          value={form.title}
          onChange={(v) => set("title", v)}
          maxLength={120}
          placeholder={t("fldTitlePlaceholder")}
        />
        <TextArea
          label={t("fldDescription")}
          value={form.description ?? ""}
          onChange={(v) => set("description", v || null)}
          maxLength={2000}
          rows={4}
          placeholder={t("fldDescriptionPlaceholder")}
        />
        {websiteId ? (
          <HeroImageField
            label={t("fldHero")}
            websiteId={websiteId}
            path={form.hero_image_path}
            onChange={(p) => set("hero_image_path", p)}
            hint={t("fldHeroHint")}
          />
        ) : (
          <Field label={t("fldHero")} hint={t("fldHeroHintOptional")}>
            <p className="mt-1.5 rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[12.5px] text-brand-mute">
              {t("heroNoWebsite")}
            </p>
          </Field>
        )}
      </Section>

      {/* Policy ------------------------------------------------------ */}
      <Section title={t("secPolicyTitle")} subtitle={t("secPolicySub")}>
        <SelectField
          label={t("fldPolicy")}
          value={form.cancellation_policy_id ?? ""}
          options={policyOptions}
          onChange={(v) => set("cancellation_policy_id", v || null)}
        />
      </Section>

      {/* Visibility -------------------------------------------------- */}
      <Section title={t("secVisibilityTitle")} subtitle={t("secVisibilitySub")}>
        <ToggleField
          label={t("fldDirectory")}
          hint={t("fldDirectoryHint")}
          checked={form.show_in_directory}
          onChange={(v) => set("show_in_directory", v)}
        />
        <ToggleField
          label={t("fldWebsite")}
          hint={t("fldWebsiteHint")}
          checked={form.show_on_website}
          onChange={(v) => set("show_on_website", v)}
        />
        {linkOnly ? (
          <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[12.5px] text-brand-mute">
            {t.rich("linkOnlyNote", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        ) : null}
      </Section>

      {/* Save bar ---------------------------------------------------- */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 rounded-card border border-brand-line bg-white/90 px-4 py-3 shadow-card backdrop-blur">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("draft")}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t("saveDraft")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("active")}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {mode === "edit" && initialStatus === "active"
            ? t("saveKeepLive")
            : t("savePublish")}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-brand-ink">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-[13px] text-brand-mute">{subtitle}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function EmptyProperties() {
  const t = useTranslations("specials");
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-bold text-brand-ink">
        {t("noPropertyTitle")}
      </h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
        {t("noPropertyBody")}
      </p>
      <Link
        href="/dashboard/properties"
        className="mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
      >
        {t("noPropertyCta")}
      </Link>
    </div>
  );
}
