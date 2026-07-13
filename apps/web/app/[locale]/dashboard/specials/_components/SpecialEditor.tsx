"use client";

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BedDouble,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  ClipboardCheck,
  Globe,
  Layers,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  TrendingDown,
  Type as TypeIcon,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { grossVat } from "@/lib/pricing/vat";
import { priceSpecialWithSavings } from "@/lib/specials/pricing";
import type { PricingUnit, StayAddon } from "@/lib/pricing";
import { websiteAssetUrl } from "@/lib/website/assets";
import {
  ADDON_CATEGORIES,
  PRICING_MODELS,
  defaultAddonQuantity,
  type AddonCategory,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";

import {
  createInlineAddonAction,
  createSpecialAction,
  updateSpecialAction,
} from "../actions";
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

const DAY_MS = 86_400_000;
function nightsBetweenIso(a: string, b: string): number {
  const f = Date.parse(`${a}T00:00:00Z`);
  const t = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((t - f) / DAY_MS));
}
function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

type SectionKey =
  | "details"
  | "property"
  | "dates"
  | "pricing"
  | "availability"
  | "extras"
  | "merch"
  | "publish"
  | "review";

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

  // Dynamically added addons (created inline via the "Add custom extra" form).
  // Carries the pricing model + default qty so the live economics can price a
  // just-created compulsory extra without a round-trip.
  type DynamicAddon = {
    id: string;
    name: string;
    unitPrice: number;
    currency: string;
    pricingModel: PricingModel;
    minQuantity: number;
  };
  const [dynamicAddons, setDynamicAddons] = useState<DynamicAddon[]>([]);

  // Inline addon form state
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlinePrice, setInlinePrice] = useState<number | null>(null);
  const [inlineSaveToLibrary, setInlineSaveToLibrary] = useState(false);
  const [inlineCreating, setInlineCreating] = useState(false);
  const [inlinePricingModel, setInlinePricingModel] =
    useState<PricingModel>("per_stay");
  const [inlineMinQty, setInlineMinQty] = useState<number | null>(1);
  const [inlineCategory, setInlineCategory] = useState<string>("");
  const [inlineDescription, setInlineDescription] = useState("");

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

  // Create an inline addon (custom extra) and add it to the special
  async function handleCreateInlineAddon() {
    if (!inlineName.trim()) {
      toast.error(t("inlineNameRequired"));
      return;
    }
    if (inlinePrice == null || inlinePrice < 0) {
      toast.error(t("inlinePriceRequired"));
      return;
    }
    setInlineCreating(true);
    try {
      const res = await createInlineAddonAction({
        name: inlineName.trim(),
        unitPrice: inlinePrice,
        currency,
        saveToLibrary: inlineSaveToLibrary,
        pricingModel: inlinePricingModel,
        minQuantity: inlineMinQty ?? 1,
        category: inlineCategory ? (inlineCategory as AddonCategory) : null,
        description: inlineDescription.trim() || null,
      });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Failed to create extra." : res.error);
        return;
      }
      const newAddon = res.data;
      // Add to dynamic addons for display (carry pricing model + default qty so
      // the live economics can price it immediately).
      setDynamicAddons((prev) => [
        ...prev,
        {
          ...newAddon,
          pricingModel: inlinePricingModel,
          minQuantity: inlineMinQty ?? 1,
        },
      ]);
      // Auto-select this addon in the form
      setForm((f) => ({
        ...f,
        addons: [
          ...f.addons,
          {
            addon_id: newAddon.id,
            is_required: true, // default to compulsory for custom extras
            unit_price_override: null,
            quantity: 1,
          },
        ],
      }));
      // Reset form
      setInlineName("");
      setInlinePrice(null);
      setInlineSaveToLibrary(false);
      setInlinePricingModel("per_stay");
      setInlineMinQty(1);
      setInlineCategory("");
      setInlineDescription("");
      setShowInlineForm(false);
      toast.success(t("inlineAddonCreated"));
    } finally {
      setInlineCreating(false);
    }
  }

  // Combine library addons with dynamically created ones
  const allAddons = useMemo(() => {
    return [...data.addons, ...dynamicAddons];
  }, [data.addons, dynamicAddons]);

  // ── Live deal economics ─────────────────────────────────────────────
  // Prices the deal AND its "normal rate" shadow with the SAME engine the save
  // path uses (`priceSpecialWithSavings`), so the host sees the guest price +
  // real savings update as they type. Representative stay + unit + required
  // add-ons mirror `_lib/savings.ts`. Advisory only — the server re-computes and
  // stores the badge authoritatively at save.
  const economics = useMemo(() => {
    if (!selectedProperty) return null;
    const dates =
      form.date_mode === "fixed"
        ? form.fixed_check_in && form.fixed_check_out
          ? { checkIn: form.fixed_check_in, checkOut: form.fixed_check_out }
          : null
        : form.window_start && form.min_nights
          ? {
              checkIn: form.window_start,
              checkOut: addDaysIso(form.window_start, form.min_nights),
            }
          : null;
    if (!dates) return null;
    const priceSet =
      form.price_mode === "flat"
        ? (form.flat_total ?? 0) > 0
        : (form.per_night_price ?? 0) > 0;
    if (!priceSet) return null;

    const room = form.room_id
      ? (selectedProperty.rooms.find((r) => r.id === form.room_id) ?? null)
      : null;
    const guests =
      form.max_guests ?? room?.maxGuests ?? selectedProperty.maxGuests ?? 1;

    const unit: PricingUnit | null = room
      ? room.basePrice == null
        ? null
        : {
            roomId: room.id,
            pricing_mode: room.pricingMode as PricingUnit["pricing_mode"],
            base_price: room.basePrice,
            price_per_person: room.pricePerPerson,
            base_occupancy: room.baseOccupancy,
            extra_guest_price: room.extraGuestPrice,
            weekend_price: room.weekendPrice,
            cleaning_fee: room.cleaningFee,
            guests,
          }
      : selectedProperty.basePrice == null
        ? null
        : {
            roomId: null,
            pricing_mode: "per_room",
            base_price: selectedProperty.basePrice,
            price_per_person: null,
            base_occupancy: null,
            extra_guest_price: null,
            weekend_price: selectedProperty.weekendPrice,
            cleaning_fee: selectedProperty.cleaningFee,
            guests,
          };
    // No configured rate to compare against — can't show economics yet.
    if (!unit) return { noRate: true as const };

    const nights = Math.max(1, nightsBetweenIso(dates.checkIn, dates.checkOut));
    const requiredAddons: StayAddon[] = form.addons
      .filter((a) => a.is_required)
      .flatMap((a) => {
        const cat = allAddons.find((x) => x.id === a.addon_id);
        if (!cat) return [];
        const model = cat.pricingModel;
        const unitPrice = a.unit_price_override ?? cat.unitPrice;
        const line: StayAddon = {
          label: cat.name,
          pricingModel: model,
          unitPrice,
          quantity: defaultAddonQuantity(model, cat.minQuantity ?? 1, nights),
          addonId: a.addon_id,
        };
        return [line];
      });

    const { special, savings } = priceSpecialWithSavings({
      priceMode: form.price_mode,
      flatTotal: form.flat_total,
      perNightPrice: form.per_night_price,
      currency,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      unit,
      totalGuests: guests,
      seasonalRules: selectedProperty.seasonalRules,
      requiredAddons,
    });
    const vr = selectedProperty.vatRate;
    return {
      noRate: false as const,
      nights,
      guests,
      flexible: form.date_mode !== "fixed",
      guestPays: grossVat(special.total, vr),
      perNight: grossVat(special.total / nights, vr),
      wasPrice:
        savings.wasPrice != null ? grossVat(savings.wasPrice, vr) : null,
      savingsAmount:
        savings.savingsAmount != null
          ? grossVat(savings.savingsAmount, vr)
          : null,
      savingsPct: savings.savingsPct,
      vatRate: vr,
    };
  }, [form, selectedProperty, allAddons, currency]);

  // The required (compulsory) add-on names — "what's included" chips on the card.
  const includedAddonNames = useMemo(
    () =>
      form.addons
        .filter((a) => a.is_required)
        .map((a) => allAddons.find((x) => x.id === a.addon_id)?.name)
        .filter((n): n is string => !!n),
    [form.addons, allAddons],
  );

  // Guest-facing stay/date summary — mirrors the public deal card exactly.
  const stayLabel = useMemo(() => {
    if (form.date_mode === "fixed") {
      const n =
        form.fixed_check_in && form.fixed_check_out
          ? nightsBetweenIso(form.fixed_check_in, form.fixed_check_out)
          : 0;
      return n > 0 ? `${n} night${n === 1 ? "" : "s"} · fixed dates` : null;
    }
    if (form.is_evergreen)
      return `Any ${form.min_nights ?? 1}+ nights · anytime`;
    if (form.max_nights && form.min_nights === form.max_nights)
      return `${form.min_nights} night${form.min_nights === 1 ? "" : "s"}`;
    return `Any ${form.min_nights ?? 1}${
      form.max_nights ? `–${form.max_nights}` : "+"
    } nights`;
  }, [
    form.date_mode,
    form.fixed_check_in,
    form.fixed_check_out,
    form.is_evergreen,
    form.min_nights,
    form.max_nights,
  ]);

  function submit(status: SpecialEditorStatus) {
    if (!form.property_id) {
      toast.error(t("pickPropertyFirst"));
      setSection("property");
      return;
    }
    // A fixed-date deal can only ever sell 1 (the room is booked for those exact
    // dates), so its quantity is always 1 — coerce here so an existing deal that
    // was seeded/saved with a stale quantity still passes validation on re-save.
    const payload: SpecialInput = {
      ...form,
      status,
      quantity: form.date_mode === "fixed" ? 1 : form.quantity,
    };
    startTransition(async () => {
      try {
        const res =
          mode === "create"
            ? await createSpecialAction(payload)
            : await updateSpecialAction(specialId as string, payload);
        if (res.ok) {
          // Warn the host when the deal barely beats (or doesn't beat) their
          // current rate for these dates — savings are computed against the
          // seasonally-adjusted rate, so a deal priced above an active season's
          // discount shows no/low saving. The save still succeeds; we keep the
          // host on the editor so they can reprice.
          const sv = res.data?.savings;
          const MIN_MEANINGFUL_PCT = 5;
          const noSaving =
            !sv || sv.savingsAmount == null || sv.savingsAmount <= 0;
          const tinySaving =
            !noSaving &&
            sv.savingsPct != null &&
            sv.savingsPct < MIN_MEANINGFUL_PCT;
          if (noSaving || tinySaving) {
            toast.warning(
              noSaving
                ? "Saved — but guests won’t see a saving: your deal price isn’t below your current rate for these dates (including any active seasonal discount). Lower it to make it a real deal."
                : `Saved — but guests only save ${sv?.savingsPct}% versus your current rate. Consider a lower price so the deal stands out.`,
              { duration: 11000 },
            );
            const editId =
              mode === "create"
                ? (res.data as unknown as { id: string }).id
                : (specialId as string);
            router.push(`/dashboard/specials/${editId}/edit`);
            router.refresh();
            return;
          }
          toast.success(
            mode === "create" ? t("toastCreated") : t("toastSaved"),
          );
          router.push("/dashboard/specials");
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        // A rejected server action (e.g. a stale build's action-id mismatch, or
        // an unexpected server throw) must never fail silently — surface it so
        // the host gets feedback and we can see the real cause in the console.
        console.error("Special save failed:", err);
        toast.error("Couldn't save the special. Please try again.");
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
      : form.is_evergreen
        ? !!form.window_start
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
      case "review":
        return allDone;
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
      case "review":
        return allDone ? "Ready to publish" : `${doneCount}/4 ready`;
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
    { key: "review", label: "Review", icon: ClipboardCheck },
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
    review: "Review & publish",
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
    review: "One last look at the whole deal before it goes live.",
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

          {/* ── live deal economics ── */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              <Wallet className="h-3 w-3" /> Deal economics
            </div>
            <div className="rounded-card border border-brand-line bg-white p-3.5 shadow-card">
              {economics == null ? (
                <p className="text-[12px] leading-relaxed text-brand-mute">
                  Set the <span className="font-medium">dates</span> and{" "}
                  <span className="font-medium">price</span> to see what guests
                  pay and how much they save.
                </p>
              ) : economics.noRate ? (
                <p className="text-[12px] leading-relaxed text-brand-mute">
                  Add a nightly rate to this{" "}
                  {form.room_id ? "room" : "property"} so we can show the saving
                  versus your normal rate.
                </p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[10.5px] font-medium uppercase tracking-wide text-brand-mute">
                        Guests pay{economics.vatRate > 0 ? " · incl. VAT" : ""}
                      </div>
                      <div className="font-display text-[22px] font-extrabold leading-none text-brand-ink">
                        {formatMoney(economics.guestPays, currency)}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-brand-mute">
                      {economics.nights} night
                      {economics.nights === 1 ? "" : "s"}
                      <br />
                      {formatMoney(economics.perNight, currency)}/night
                    </div>
                  </div>

                  {economics.wasPrice != null ? (
                    <div className="flex items-center justify-between border-t border-brand-line/70 pt-2 text-[12px]">
                      <span className="text-brand-mute">Normal rate</span>
                      <span className="font-medium text-brand-ink line-through">
                        {formatMoney(economics.wasPrice, currency)}
                      </span>
                    </div>
                  ) : null}

                  {economics.savingsAmount != null && economics.savingsPct ? (
                    <div className="flex items-center justify-between rounded-[9px] bg-emerald-50 px-2.5 py-1.5 text-[12px]">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <TrendingDown className="h-3.5 w-3.5" /> Guests save
                      </span>
                      <span className="font-bold text-emerald-700">
                        {formatMoney(economics.savingsAmount, currency)} ·{" "}
                        {economics.savingsPct}%
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-[9px] bg-amber-50 px-2.5 py-1.5 text-[11.5px] leading-snug text-amber-800">
                      No saving versus your rate for these dates — lower the
                      price to make it a real deal.
                    </div>
                  )}

                  {economics.flexible ? (
                    <p className="text-[10.5px] leading-snug text-brand-mute">
                      Based on a {economics.nights}-night stay from your window
                      start; longer stays scale up.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* ── docked guest preview — mirrors the public deal card ── */}
          <div className="mt-4">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              {t("previewSiteLabel")}
            </div>
            <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-brand-accent">
                {heroUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-brand-primary">
                    <Sparkles className="h-7 w-7" />
                  </div>
                )}
                {form.badge ? (
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2 py-0.5 text-[9.5px] font-bold text-white shadow">
                    <Tag className="h-2.5 w-2.5" />
                    {form.badge}
                  </span>
                ) : null}
                {economics && !economics.noRate && economics.savingsPct ? (
                  <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-pill bg-emerald-600 px-2 py-0.5 text-[9.5px] font-bold text-white shadow">
                    {economics.savingsPct}% off
                  </span>
                ) : null}
              </div>
              <div className="p-3">
                <div className="truncate font-display text-[13.5px] font-bold text-brand-ink">
                  {displayName}
                </div>
                {stayLabel ? (
                  <div className="mt-0.5 flex items-center gap-1 text-[10.5px] font-medium text-brand-secondary">
                    <CalendarRange className="h-3 w-3 shrink-0" />
                    <span className="truncate">{stayLabel}</span>
                  </div>
                ) : null}
                {form.description ? (
                  <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-brand-mute">
                    {form.description}
                  </div>
                ) : null}
                {previewAmount ? (
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-display text-[14px] font-bold text-brand-ink">
                      {formatMoney(
                        grossVat(previewAmount, selectedProperty?.vatRate ?? 0),
                        currency,
                      )}
                    </span>
                    <span className="text-[10.5px] text-brand-mute">
                      {form.price_mode === "flat"
                        ? t("dtPackageTotal")
                        : t("dtPerNight")}
                    </span>
                    {economics && !economics.noRate && economics.wasPrice ? (
                      <span className="text-[10.5px] text-brand-mute line-through">
                        {formatMoney(
                          form.price_mode === "flat"
                            ? economics.wasPrice
                            : economics.wasPrice / economics.nights,
                          currency,
                        )}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {economics && !economics.noRate && economics.savingsAmount ? (
                  <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                    Save {formatMoney(economics.savingsAmount, currency)}
                  </div>
                ) : null}
                {includedAddonNames.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {includedAddonNames.slice(0, 3).map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 rounded-pill bg-brand-accent/40 px-2 py-0.5 text-[10px] font-medium text-brand-secondary"
                      >
                        <Check className="h-2.5 w-2.5" />
                        {name}
                      </span>
                    ))}
                    {includedAddonNames.length > 3 ? (
                      <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute">
                        +{includedAddonNames.length - 3} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-primary bg-brand-accent/40 px-4 py-2 text-[12px] font-semibold text-brand-secondary">
                  <CalendarCheck className="h-3.5 w-3.5" /> {t("previewBook")}
                </div>
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
                    <ToggleField
                      label="Run continuously (always on)"
                      hint="No end date or booking deadline — guests can book any future dates."
                      checked={form.is_evergreen}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          is_evergreen: v,
                          window_start:
                            v && !f.window_start
                              ? new Date().toISOString().slice(0, 10)
                              : f.window_start,
                          window_end: v ? null : f.window_end,
                          book_by: v ? null : f.book_by,
                        }))
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <DateField
                        label={
                          form.is_evergreen
                            ? "Available from"
                            : t("fldWindowStart")
                        }
                        value={form.window_start}
                        onChange={(v) => set("window_start", v)}
                      />
                      {form.is_evergreen ? (
                        <div className="flex items-end pb-2.5 text-[12.5px] text-brand-mute">
                          Runs continuously — no end date.
                        </div>
                      ) : (
                        <DateField
                          label={t("fldWindowEnd")}
                          value={form.window_end}
                          min={form.window_start ?? undefined}
                          onChange={(v) => set("window_end", v)}
                        />
                      )}
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
                  {form.is_evergreen ? (
                    <div className="flex items-end pb-2.5 text-[12.5px] text-brand-mute">
                      No booking deadline — this deal runs continuously.
                    </div>
                  ) : (
                    <DateField
                      label={t("fldBookBy")}
                      value={form.book_by}
                      onChange={(v) => set("book_by", v)}
                      hint={t("fldBookByHint")}
                    />
                  )}
                </div>
              </>
            ) : null}

            {section === "extras" ? (
              <div className="space-y-3">
                {/* Existing addons list */}
                {allAddons.length > 0 ? (
                  <div className="space-y-2">
                    {allAddons.map((addon) => {
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
                                  patchAddon(addon.id, {
                                    unit_price_override: v,
                                  })
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[13px] text-brand-mute">
                    {t("addonsEmpty")}
                  </p>
                )}

                {/* Inline addon creation form */}
                {showInlineForm ? (
                  <div className="rounded-[10px] border-2 border-dashed border-brand-primary/40 bg-brand-accent/10 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-brand-ink">
                        {t("inlineFormTitle")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowInlineForm(false)}
                        className="text-brand-mute hover:text-brand-ink"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        label={t("inlineNameLabel")}
                        value={inlineName}
                        onChange={setInlineName}
                        placeholder={t("inlineNamePlaceholder")}
                        maxLength={120}
                      />
                      <NumberField
                        label={t("inlinePriceLabel")}
                        value={inlinePrice}
                        min={0}
                        step={0.01}
                        prefix={currency}
                        onChange={setInlinePrice}
                      />
                    </div>
                    <div className="mt-3">
                      <TextArea
                        label="Description (optional)"
                        value={inlineDescription}
                        onChange={setInlineDescription}
                        placeholder="What the guest gets — shown on the deal."
                        rows={2}
                        maxLength={280}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <SelectField
                        label="How it’s charged"
                        value={inlinePricingModel}
                        options={PRICING_MODELS.map((m) => ({
                          value: m.value,
                          label: m.label,
                        }))}
                        onChange={setInlinePricingModel}
                        hint="How the price scales per stay."
                      />
                      <NumberField
                        label="Default quantity"
                        value={inlineMinQty}
                        min={1}
                        max={100}
                        onChange={setInlineMinQty}
                        hint="Added by default when selected."
                      />
                    </div>
                    <div className="mt-3">
                      <SelectField
                        label="Category (optional)"
                        value={inlineCategory}
                        options={[
                          { value: "", label: "No category" },
                          ...ADDON_CATEGORIES.map((c) => ({
                            value: c.value as string,
                            label: c.label,
                          })),
                        ]}
                        onChange={setInlineCategory}
                      />
                    </div>
                    <div className="mt-3">
                      <ToggleField
                        label={t("inlineSaveToLibrary")}
                        hint={t("inlineSaveToLibraryHint")}
                        checked={inlineSaveToLibrary}
                        onChange={setInlineSaveToLibrary}
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInlineForm(false)}
                        className="rounded-[10px] border border-brand-line bg-white px-4 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
                      >
                        {t("inlineCancel")}
                      </button>
                      <button
                        type="button"
                        disabled={inlineCreating}
                        onClick={handleCreateInlineAddon}
                        className="inline-flex items-center gap-2 rounded-[10px] bg-brand-primary px-4 py-2 text-[13px] font-medium text-white transition hover:bg-brand-secondary disabled:opacity-50"
                      >
                        {inlineCreating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        {t("inlineCreate")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowInlineForm(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-brand-line bg-white px-4 py-3 text-[13px] font-medium text-brand-mute transition hover:border-brand-primary/40 hover:bg-brand-accent/10 hover:text-brand-primary"
                  >
                    <Plus className="h-4 w-4" />
                    {t("inlineAddCustom")}
                  </button>
                )}
              </div>
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

            {section === "review" ? (
              <div className="space-y-4">
                {/* readiness checklist */}
                <div className="rounded-[12px] border border-brand-line bg-brand-light/40 p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-display text-[14px] font-bold text-brand-ink">
                      {allDone
                        ? "Ready to publish 🎉"
                        : "A few essentials left"}
                    </span>
                    <span className="text-[11px] font-medium text-brand-mute">
                      {doneCount}/{checklist.length} done
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {(
                      [
                        [
                          "Property & target",
                          form.property_id !== "",
                          "property",
                        ],
                        ["Title", form.title.trim().length > 0, "details"],
                        ["Dates", datesValid, "dates"],
                        ["Price", priceValid, "pricing"],
                      ] as [string, boolean, SectionKey][]
                    ).map(([label, ok, key]) => (
                      <li
                        key={label}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2 text-[12.5px]">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full ${
                              ok
                                ? "bg-brand-primary text-white"
                                : "border border-brand-line bg-white"
                            }`}
                          >
                            {ok ? <Check className="h-2.5 w-2.5" /> : null}
                          </span>
                          <span
                            className={
                              ok ? "text-brand-ink" : "text-brand-mute"
                            }
                          >
                            {label}
                          </span>
                        </span>
                        {!ok ? (
                          <button
                            type="button"
                            onClick={() => setSection(key)}
                            className="text-[11.5px] font-medium text-brand-primary hover:underline"
                          >
                            Add now
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* at-a-glance summary */}
                <div className="overflow-hidden rounded-[12px] border border-brand-line">
                  <SummaryRow
                    label="Deal"
                    value={displayName}
                    onEdit={() => setSection("details")}
                  />
                  <SummaryRow
                    label="Where"
                    value={
                      selectedProperty
                        ? `${selectedProperty.name} · ${
                            form.room_id
                              ? (selectedProperty.rooms.find(
                                  (r) => r.id === form.room_id,
                                )?.name ?? "Room")
                              : "Whole property"
                          }`
                        : "Not chosen"
                    }
                    onEdit={() => setSection("property")}
                  />
                  <SummaryRow
                    label="Dates"
                    value={
                      stayLabel ??
                      (form.date_mode === "fixed"
                        ? "Fixed dates not set"
                        : "Window not set")
                    }
                    onEdit={() => setSection("dates")}
                  />
                  <SummaryRow
                    label="Guests pay"
                    value={
                      economics && !economics.noRate
                        ? `${formatMoney(economics.guestPays, currency)}${
                            economics.vatRate > 0 ? " incl. VAT" : ""
                          } · ${economics.nights} night${
                            economics.nights === 1 ? "" : "s"
                          }`
                        : priceValid
                          ? `${formatMoney(
                              grossVat(
                                previewAmount ?? 0,
                                selectedProperty?.vatRate ?? 0,
                              ),
                              currency,
                            )} ${
                              form.price_mode === "flat"
                                ? "package"
                                : "per night"
                            }`
                          : "Not set"
                    }
                    onEdit={() => setSection("pricing")}
                  />
                  <SummaryRow
                    label="Savings"
                    value={
                      economics && !economics.noRate
                        ? economics.savingsAmount != null &&
                          economics.savingsPct
                          ? `Guests save ${formatMoney(
                              economics.savingsAmount,
                              currency,
                            )} (${economics.savingsPct}%)`
                          : "No saving vs your rate yet"
                        : "—"
                    }
                    tone={
                      economics && !economics.noRate && economics.savingsAmount
                        ? "good"
                        : economics && !economics.noRate
                          ? "warn"
                          : "muted"
                    }
                    onEdit={() => setSection("pricing")}
                  />
                  <SummaryRow
                    label="Availability"
                    value={
                      form.date_mode === "fixed"
                        ? "1 booking (fixed dates)"
                        : `${form.quantity ?? 0} available`
                    }
                    onEdit={() => setSection("availability")}
                  />
                  <SummaryRow
                    label="Extras"
                    value={
                      form.addons.length > 0
                        ? `${form.addons.length} add-on${
                            form.addons.length === 1 ? "" : "s"
                          }${
                            includedAddonNames.length > 0
                              ? ` · ${includedAddonNames.length} included`
                              : ""
                          }`
                        : "None"
                    }
                    onEdit={() => setSection("extras")}
                  />
                  <SummaryRow
                    label="Visibility"
                    value={
                      linkOnly
                        ? "Link only"
                        : [
                            form.show_in_directory ? "Directory" : null,
                            form.show_on_website ? "Website" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                    }
                    onEdit={() => setSection("publish")}
                  />
                </div>

                {/* publish CTA */}
                <button
                  type="button"
                  onClick={() => submit("active")}
                  disabled={pending || !allDone}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-4 py-3 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-50"
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
                {!allDone ? (
                  <p className="text-center text-[11.5px] text-brand-mute">
                    Complete the essentials above to publish. You can still{" "}
                    <button
                      type="button"
                      onClick={() => submit("draft")}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      save as a draft
                    </button>{" "}
                    for now.
                  </p>
                ) : null}
              </div>
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

// One line of the at-a-glance review summary: label · value · quick-jump edit.
function SummaryRow({
  label,
  value,
  tone = "default",
  onEdit,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "muted";
  onEdit?: () => void;
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-700 font-semibold"
      : tone === "warn"
        ? "text-amber-700 font-medium"
        : tone === "muted"
          ? "text-brand-mute"
          : "text-brand-ink font-medium";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-line bg-white px-3.5 py-2.5 last:border-b-0">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`truncate text-right text-[12.5px] ${valueClass}`}>
          {value}
        </span>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-mute transition hover:bg-brand-light hover:text-brand-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </span>
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
