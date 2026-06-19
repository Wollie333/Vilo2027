"use client";

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BedDouble,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Globe,
  Layers,
  Loader2,
  PackagePlus,
  Sparkles,
  Tag,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { websiteAssetUrl } from "@/lib/website/assets";

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

type SectionKey =
  | "details"
  | "property"
  | "dates"
  | "pricing"
  | "availability"
  | "extras"
  | "merch"
  | "publish";

type SectionDef = { key: SectionKey; label: string; icon: LucideIcon };

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
  const [section, setSection] = useState<SectionKey>("details");

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

  function toggleCategory(key: string) {
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
                quantity: 1,
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
      setSection("property");
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

  // ---- derived: validity + per-section completion ----
  const datesValid =
    form.date_mode === "fixed"
      ? !!form.fixed_check_in && !!form.fixed_check_out
      : !!form.window_start && !!form.window_end;
  const priceValid =
    form.price_mode === "flat"
      ? (form.flat_total ?? 0) > 0
      : (form.per_night_price ?? 0) > 0;

  const checklist = [
    form.property_id !== "",
    form.title.trim().length > 0,
    datesValid,
    priceValid,
  ];
  const doneCount = checklist.filter(Boolean).length;
  const pct = Math.round((doneCount / checklist.length) * 100);
  const allDone = doneCount === checklist.length;

  function sectionDone(key: SectionKey): boolean {
    switch (key) {
      case "details":
        return form.title.trim().length > 0;
      case "property":
        return form.property_id !== "";
      case "dates":
        return datesValid;
      case "pricing":
        return priceValid;
      case "availability":
        return (form.quantity ?? 0) > 0;
      case "extras":
        return form.addons.length > 0;
      case "merch":
        return form.categories.length > 0 || !!form.badge;
      case "publish":
        return form.show_in_directory || form.show_on_website;
    }
  }

  function railSub(key: SectionKey): string {
    switch (key) {
      case "details":
        return form.title.trim() || t("railNotSet");
      case "property":
        return selectedProperty
          ? form.room_id
            ? (selectedProperty.rooms.find((r) => r.id === form.room_id)
                ?.name ?? t("railWholeProperty"))
            : t("railWholeProperty")
          : t("railPropertyNone");
      case "dates":
        return form.date_mode === "fixed" ? t("dateFixed") : t("dateFlexible");
      case "pricing":
        return priceValid
          ? form.price_mode === "flat"
            ? t("priceTotal", {
                amount: formatMoney(form.flat_total, currency),
              })
            : t("pricePerNight", {
                amount: formatMoney(form.per_night_price, currency),
              })
          : t("railNotSet");
      case "availability":
        return t("railQty", { count: form.quantity ?? 0 });
      case "extras":
        return t("railAddonCount", { count: form.addons.length });
      case "merch":
        return t("railCatCount", { count: form.categories.length });
      case "publish":
        return linkOnly
          ? t("railVisLinkOnly")
          : [
              form.show_in_directory ? t("chipDirectory") : null,
              form.show_on_website ? t("chipWebsite") : null,
            ]
              .filter(Boolean)
              .join(" · ");
    }
  }

  const SECTIONS: SectionDef[] = [
    { key: "details", label: t("navDetails"), icon: TypeIcon },
    { key: "property", label: t("navProperty"), icon: BedDouble },
    { key: "dates", label: t("navDates"), icon: CalendarDays },
    { key: "pricing", label: t("navPricing"), icon: Banknote },
    { key: "availability", label: t("navAvailability"), icon: Layers },
    { key: "extras", label: t("navExtras"), icon: PackagePlus },
    { key: "merch", label: t("navMerch"), icon: Tag },
    { key: "publish", label: t("navPublish"), icon: Globe },
  ];
  const sectionIdx = SECTIONS.findIndex((s) => s.key === section);
  const isLast = sectionIdx === SECTIONS.length - 1;

  const displayName = form.title.trim() || t("idUntitled");
  const heroUrl = websiteAssetUrl(form.hero_image_path);
  const previewAmount =
    form.price_mode === "flat" ? form.flat_total : form.per_night_price;
  const isActive = form.status === "active";

  const panelTitle: Record<SectionKey, string> = {
    details: t("secPresentTitle"),
    property: t("secTargetTitle"),
    dates: t("secDatesTitle"),
    pricing: t("secPriceTitle"),
    availability: t("secAvailTitle"),
    extras: t("secAddonsTitle"),
    merch: t("secMerchTitle"),
    publish: t("secVisibilityTitle"),
  };
  const panelDesc: Record<SectionKey, string> = {
    details: t("secPresentSub"),
    property: t("secTargetSub"),
    dates: t("secDatesSub"),
    pricing: t("secPriceSub", { currency }),
    availability: t("secAvailSub"),
    extras: t("secAddonsSub"),
    merch: t("secMerchSub"),
    publish: t("secVisibilitySub"),
  };
  const PanelIcon = SECTIONS[sectionIdx]?.icon ?? TypeIcon;

  return (
    <div className="space-y-5">
      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[11px] border border-brand-line bg-brand-light">
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-mute">
              <Sparkles className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/dashboard/specials" className="hover:text-brand-ink">
              {t("mgrCrumb")}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">
              {mode === "create" ? t("badgeNew") : t("menuEdit")}
            </span>
          </nav>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h1 className="truncate font-display text-[19px] font-extrabold leading-none text-brand-ink">
              {displayName}
            </h1>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${
                isActive
                  ? "border-brand-primary/30 bg-brand-accent text-brand-secondary"
                  : "border-brand-line bg-brand-light text-brand-mute"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive ? "bg-brand-primary" : "bg-brand-mute"
                }`}
              />
              {t(`status_${form.status}`)}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/specials"
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            {t("cancel")}
          </Link>
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveDraft")}
          </button>
          <button
            type="button"
            onClick={() => submit("active")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
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

      {/* ============ SPLIT: rail + active panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[288px_1fr]">
        {/* section rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card">
            <ProgressRing pct={pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {allDone ? t("progReady") : t("progAlmost")}
              </div>
              <div className="text-[11px] text-brand-mute">
                {allDone ? t("progReadySub") : t("progAlmostSub")}
              </div>
            </div>
          </div>

          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            {t("navSectionsLabel")}
          </div>
          <div className="space-y-1">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const active = section === key;
              const done = sectionDone(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSection(key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-brand-line bg-white shadow-card"
                      : "border-transparent hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
                      active
                        ? "bg-brand-primary text-white"
                        : "bg-brand-accent/70 text-brand-secondary"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] font-semibold leading-tight ${
                        active ? "text-brand-ink" : "text-brand-ink/80"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                      {railSub(key)}
                    </span>
                  </span>
                  {done ? (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* docked guest preview — mirrors the public deal card */}
          <div className="mt-4">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              {t("previewSiteLabel")}
            </div>
            <div className="rounded-card border border-brand-line bg-white p-3 shadow-card">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[11px] bg-brand-accent">
                  {heroUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-brand-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                  )}
                  {form.badge ? (
                    <span className="absolute left-0 top-1.5 inline-flex items-center gap-1 rounded-r-pill bg-brand-primary px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow">
                      <Tag className="h-2.5 w-2.5" />
                      {form.badge}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[13px] font-bold text-brand-ink">
                    {displayName}
                  </div>
                  {form.description ? (
                    <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-brand-mute">
                      {form.description}
                    </div>
                  ) : null}
                  {previewAmount ? (
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-display text-[13.5px] font-bold text-brand-primary">
                        {formatMoney(previewAmount, currency)}
                      </span>
                      <span className="text-[10.5px] text-brand-mute">
                        {form.price_mode === "flat"
                          ? t("dtPackageTotal")
                          : t("dtPerNight")}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-primary bg-brand-accent/40 px-4 py-2 text-[12.5px] font-semibold text-brand-secondary">
                <CalendarCheck className="h-3.5 w-3.5" /> {t("previewBook")}
              </div>
            </div>
          </div>
        </aside>

        {/* ============ ACTIVE PANEL ============ */}
        <div className="min-w-0">
          <div className="mb-5 flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
              <PanelIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-extrabold leading-tight text-brand-ink">
                {panelTitle[section]}
              </h2>
              <p className="mt-0.5 text-[13.5px] text-brand-mute">
                {panelDesc[section]}
              </p>
            </div>
          </div>

          <Panel>
            {section === "details" ? (
              <>
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
              </>
            ) : null}

            {section === "property" ? (
              <>
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
              </>
            ) : null}

            {section === "dates" ? (
              <>
                <SegmentField
                  label={t("fldDateMode")}
                  value={form.date_mode}
                  onChange={(v) => {
                    // When switching to fixed-date, force quantity to 1
                    // (only one booking possible for those exact dates)
                    if (v === "fixed") {
                      setForm((f) => ({ ...f, date_mode: v, quantity: 1 }));
                    } else {
                      set("date_mode", v);
                    }
                  }}
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
              </>
            ) : null}

            {section === "pricing" ? (
              <>
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
              </>
            ) : null}

            {section === "availability" ? (
              <>
                {form.date_mode === "fixed" ? (
                  <div className="rounded-[10px] border border-brand-line bg-brand-light/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-brand-ink">
                        {t("fldQuantity")}
                      </span>
                      <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[11px] font-bold text-brand-secondary">
                        1
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-brand-mute">
                      {t("fldQuantityFixedHint")}
                    </p>
                  </div>
                ) : (
                  <NumberField
                    label={t("fldQuantity")}
                    value={form.quantity}
                    min={1}
                    max={100000}
                    onChange={(v) => set("quantity", v ?? 1)}
                    hint={t("fldQuantityHint")}
                  />
                )}
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
              </>
            ) : null}

            {section === "extras" ? (
              data.addons.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[13px] text-brand-mute">
                  {t("addonsEmpty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {data.addons.map((addon) => {
                    const selected = form.addons.find(
                      (a) => a.addon_id === addon.id,
                    );
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
                          <div className="mt-3 grid grid-cols-3 items-end gap-3 border-t border-brand-line/70 pt-3">
                            <NumberField
                              label={t("fldAddonQty")}
                              value={selected.quantity ?? 1}
                              min={1}
                              max={100}
                              onChange={(v) =>
                                patchAddon(addon.id, { quantity: v ?? 1 })
                              }
                              hint={t("fldAddonQtyHint")}
                            />
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
              )
            ) : null}

            {section === "merch" ? (
              <>
                <div>
                  <span className="block text-[13px] font-semibold text-brand-ink">
                    {t("fldCategories")}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-brand-mute">
                    {t("fldCategoriesHint")}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.categories.length === 0 ? (
                      <p className="text-[12.5px] text-brand-mute">
                        {t("noCategoriesAvailable")}
                      </p>
                    ) : (
                      data.categories.map((c) => {
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
                            {c.label}
                          </button>
                        );
                      })
                    )}
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
              </>
            ) : null}

            {section === "publish" ? (
              <>
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
                <div className="border-t border-brand-line pt-4">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-brand-ink">
                    {t("panelPolicyTitle")}
                  </span>
                  <SelectField
                    label={t("fldPolicy")}
                    value={form.cancellation_policy_id ?? ""}
                    options={policyOptions}
                    onChange={(v) => set("cancellation_policy_id", v || null)}
                  />
                </div>
              </>
            ) : null}
          </Panel>

          {/* footer nav */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-brand-line pt-5">
            {sectionIdx > 0 ? (
              <button
                type="button"
                onClick={() => setSection(SECTIONS[sectionIdx - 1].key)}
                className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
              >
                <ArrowLeft className="h-4 w-4" />{" "}
                {SECTIONS[sectionIdx - 1].label}
              </button>
            ) : (
              <span />
            )}
            <span className="text-[12px] font-medium tabular-nums text-brand-mute">
              {t("footerStep", {
                n: sectionIdx + 1,
                total: SECTIONS.length,
              })}
            </span>
            {!isLast ? (
              <button
                type="button"
                onClick={() => setSection(SECTIONS[sectionIdx + 1].key)}
                className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
              >
                {t("footerContinue")} · {SECTIONS[sectionIdx + 1].label}{" "}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#E4EFE8"
          strokeWidth="3.4"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[11.5px] font-bold tabular-nums text-brand-ink">
        {pct}%
      </div>
    </div>
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
