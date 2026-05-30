"use client";

import {
  ArrowLeft,
  Banknote,
  Check,
  Clock,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Mail,
  Percent,
  Plus,
  ShoppingCart,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { modal } from "@/components/ui/modal-host";

import { AddonImageInput } from "./AddonImageInput";
import {
  deleteAddonAction,
  setAddonListingRoomsAction,
  toggleAddonActiveAction,
  updateAddonAction,
} from "./actions";
import {
  ADDON_CATEGORIES,
  ADDON_CATEGORY_LABEL,
  PRICING_MODELS,
  PRICING_MODEL_META,
  type AddonCategory,
  type PricingModel,
} from "./schemas";

export type AddonEditModel = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  minQuantity: number;
  maxQuantity: number | null;
  isRequired: boolean;
  isActive: boolean;
  leadTimeDays: number;
  category: AddonCategory | null;
  vatIncluded: boolean;
  dailyCapacity: number | null;
};

export type AddonAvailability = {
  listings: {
    id: string;
    name: string;
    rooms: { id: string; name: string }[];
  }[];
  assignments: { listingId: string; roomId: string | null }[];
};

type ListingMode = "off" | "all" | "rooms";
type ListingSelection = { mode: ListingMode; roomIds: string[] };

const NAME_MAX = 48;
const DESC_MAX = 400;

const LEAD_TIME_OPTIONS = [
  { value: 0, label: "No notice" },
  { value: 1, label: "24 hours" },
  { value: 2, label: "48 hours" },
  { value: 3, label: "72 hours" },
];

function zar(v: number): string {
  return `R ${(Number.isFinite(v) ? v : 0).toLocaleString("en-ZA")}`;
}

function deriveSelection(
  listingId: string,
  assignments: AddonAvailability["assignments"],
): ListingSelection {
  const rows = assignments.filter((a) => a.listingId === listingId);
  if (rows.some((r) => r.roomId === null)) return { mode: "all", roomIds: [] };
  const roomIds = rows
    .map((r) => r.roomId)
    .filter((id): id is string => id !== null);
  if (roomIds.length > 0) return { mode: "rooms", roomIds };
  return { mode: "off", roomIds: [] };
}

export function AddonEditor({
  addon,
  availability,
}: {
  addon: AddonEditModel;
  availability: AddonAvailability;
}) {
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [availPending, startAvail] = useTransition();

  const [selections, setSelections] = useState<
    Record<string, ListingSelection>
  >(() =>
    Object.fromEntries(
      availability.listings.map((l) => [
        l.id,
        deriveSelection(l.id, availability.assignments),
      ]),
    ),
  );

  function persistSelection(listingId: string, next: ListingSelection) {
    const prev = selections[listingId] ?? { mode: "off", roomIds: [] };
    setSelections((s) => ({ ...s, [listingId]: next }));
    startAvail(async () => {
      const payload =
        next.mode === "rooms"
          ? { mode: "rooms" as const, roomIds: next.roomIds }
          : { mode: next.mode };
      const result = await setAddonListingRoomsAction(
        addon.id,
        listingId,
        payload,
      );
      if (!result.ok) {
        setSelections((s) => ({ ...s, [listingId]: prev }));
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function setListingMode(
    listing: AddonAvailability["listings"][number],
    mode: ListingMode,
  ) {
    if (mode === "rooms") {
      const current = selections[listing.id];
      const seeded =
        current && current.roomIds.length > 0
          ? current.roomIds
          : listing.rooms.map((r) => r.id);
      persistSelection(listing.id, { mode: "rooms", roomIds: seeded });
    } else {
      persistSelection(listing.id, { mode, roomIds: [] });
    }
  }

  function toggleRoom(listingId: string, roomId: string) {
    const current = selections[listingId] ?? { mode: "rooms", roomIds: [] };
    const has = current.roomIds.includes(roomId);
    const roomIds = has
      ? current.roomIds.filter((id) => id !== roomId)
      : [...current.roomIds, roomId];
    persistSelection(listingId, { mode: "rooms", roomIds });
  }

  const [name, setName] = useState(addon.name);
  const [description, setDescription] = useState(addon.description);
  const [category, setCategory] = useState<AddonCategory | null>(
    addon.category,
  );
  const [pricingModel, setPricingModel] = useState<PricingModel>(
    addon.pricingModel,
  );
  const [unitPrice, setUnitPrice] = useState(
    addon.unitPrice ? String(addon.unitPrice) : "0",
  );
  const [maxQuantity, setMaxQuantity] = useState(
    addon.maxQuantity == null ? "" : String(addon.maxQuantity),
  );
  const [leadTimeDays, setLeadTimeDays] = useState(addon.leadTimeDays);
  const [dailyCapacity, setDailyCapacity] = useState(
    addon.dailyCapacity == null ? "" : String(addon.dailyCapacity),
  );
  const [isRequired, setIsRequired] = useState(addon.isRequired);
  const [isActive, setIsActive] = useState(addon.isActive);
  const [vatIncluded, setVatIncluded] = useState(addon.vatIncluded);
  const [imageUrl, setImageUrl] = useState<string | null>(addon.imageUrl);

  const [dirty, setDirty] = useState(false);
  function touch() {
    if (!dirty) setDirty(true);
  }

  const meta = PRICING_MODEL_META[pricingModel];
  const priceNum = Number(unitPrice);
  const safePrice = Number.isFinite(priceNum) ? priceNum : 0;

  // ---- Ready-to-publish checklist ----
  const checklist = useMemo(() => {
    const items = [
      { label: "Name added", done: name.trim().length > 0 },
      { label: "Price set", done: safePrice > 0 },
      { label: "Category chosen", done: category != null },
      { label: "Photo added", done: imageUrl != null },
    ];
    const done = items.filter((i) => i.done).length;
    const pct = Math.round((done / items.length) * 100);
    return { items, pct, allDone: done === items.length };
  }, [name, safePrice, category, imageUrl]);

  function handleSave() {
    startSave(async () => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        toast.error("Add a name.");
        return;
      }
      const parsedPrice = Number(unitPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        toast.error("Enter a valid price.");
        return;
      }
      const result = await updateAddonAction(addon.id, {
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
        pricing_model: pricingModel,
        unit_price: parsedPrice,
        currency: addon.currency,
        min_quantity: addon.minQuantity,
        max_quantity: maxQuantity.trim() === "" ? null : Number(maxQuantity),
        is_required: isRequired,
        is_active: isActive,
        lead_time_days: leadTimeDays,
        category,
        vat_included: vatIncluded,
        daily_capacity:
          dailyCapacity.trim() === "" ? null : Number(dailyCapacity),
      });
      if (result.ok) {
        toast.success("Add-on saved");
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleToggleActive() {
    if (togglePending) return;
    const next = !isActive;
    setIsActive(next);
    startToggle(async () => {
      const result = await toggleAddonActiveAction(addon.id, next);
      if (!result.ok) {
        setIsActive(!next);
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const ok = await modal.destructive({
        title: `Delete "${name}"?`,
        description:
          "It will be removed from every listing it's attached to. This can't be undone.",
        confirmLabel: "Delete",
      });
      if (!ok) return;
      const result = await deleteAddonAction(addon.id);
      if (result.ok) {
        toast.success("Add-on deleted");
        router.push("/dashboard/addons");
      } else {
        toast.error(result.error);
      }
    });
  }

  const displayName = name.trim() || "Untitled add-on";
  const categoryLabel = category ? ADDON_CATEGORY_LABEL[category] : null;

  return (
    <div className="min-h-screen bg-brand-light pb-28">
      <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ===== Dark hero ===== */}
        <section
          className="relative overflow-hidden rounded-card shadow-peek"
          style={{
            backgroundImage:
              "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-brand-secondary/40 blur-3xl"
          />
          <div className="relative grid gap-0 lg:grid-cols-[1.5fr_1fr]">
            {/* info side */}
            <div className="p-6 md:p-8">
              <a
                href="/dashboard/addons"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/55 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to add-ons
              </a>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
                  Add-on editor
                </span>
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/70 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
                    Draft
                  </span>
                )}
                {categoryLabel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent/80 backdrop-blur">
                    {categoryLabel}
                  </span>
                ) : null}
                {isRequired ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent/80 backdrop-blur">
                    Required
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 font-display text-[30px] font-extrabold leading-tight tracking-tight text-white md:text-[36px]">
                {displayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-brand-accent/80">
                <span className="inline-flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5" /> {meta.label}
                </span>
                <span className="text-brand-accent/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> {meta.hint}
                </span>
              </div>

              {/* stat strip */}
              <div className="mt-6 grid max-w-md grid-cols-3 gap-3">
                <HeroFact
                  label="Price"
                  value={zar(safePrice)}
                  sub={meta.suffix}
                />
                <HeroFact label="Charge" value={meta.label} sub={meta.hint} />
                <HeroFact
                  label="Max / stay"
                  value={maxQuantity.trim() === "" ? "∞" : maxQuantity}
                  sub={maxQuantity.trim() === "" ? "no limit" : "units"}
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={savePending}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-brand-secondary shadow-glow transition-colors hover:bg-brand-accent disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {savePending ? "Saving…" : "Save add-on"}
                </button>
                {dirty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-status-pending/30 bg-status-pending/10 px-3 py-2 text-[11.5px] font-medium text-status-pending">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                    Unsaved changes
                  </span>
                ) : null}
                <div className="ml-auto flex items-center gap-2 rounded-pill border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                  <span className="text-[11.5px] font-medium text-white/90">
                    Active
                  </span>
                  <Toggle
                    checked={isActive}
                    onChange={handleToggleActive}
                    disabled={togglePending}
                    label="Toggle active"
                  />
                </div>
              </div>
            </div>

            {/* image side */}
            <div className="relative min-h-[220px] bg-brand-dark p-2">
              <div className="relative h-full min-h-[200px] overflow-hidden rounded-[12px]">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-accent/10 text-white/40">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-dark/80 to-transparent p-4">
                  <a
                    href="#sec-media"
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/95 px-3 py-2 text-[12px] font-semibold text-brand-secondary shadow-lift backdrop-blur transition hover:bg-white"
                  >
                    <ImageIcon className="h-4 w-4" /> Change photo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Two-column ===== */}
        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          {/* ----- LEFT: form ----- */}
          <div className="space-y-6">
            {/* DETAILS */}
            <Panel
              eyebrow="Details"
              title="Name & description"
              icon={<TypeIcon className="h-3.5 w-3.5" />}
            >
              <div className="space-y-5">
                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    Add-on name
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    What guests see in the extras list at checkout.
                  </p>
                  <div className="relative mt-2">
                    <input
                      type="text"
                      value={name}
                      maxLength={NAME_MAX}
                      onChange={(e) => {
                        setName(e.target.value);
                        touch();
                      }}
                      className="w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 pr-16 text-[14px] text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                    />
                    <span className="absolute right-3 top-3 text-[10.5px] tabular-nums text-brand-mute">
                      {name.length} / {NAME_MAX}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    Category
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Groups this add-on in the guest&apos;s extras list.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ADDON_CATEGORIES.map((c) => {
                      const selected = category === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            setCategory(selected ? null : c.value);
                            touch();
                          }}
                          aria-pressed={selected}
                          className={`rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                            selected
                              ? "border-brand-primary bg-brand-accent text-brand-secondary"
                              : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    Description
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Sell it in a sentence or two.
                  </p>
                  <textarea
                    rows={3}
                    value={description}
                    maxLength={DESC_MAX}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      touch();
                    }}
                    className="mt-2 w-full resize-none rounded-[10px] border border-brand-line bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                  />
                  <div className="mt-1.5 flex items-center justify-end text-[11px] tabular-nums text-brand-mute">
                    {description.length} / {DESC_MAX}
                  </div>
                </div>
              </div>
            </Panel>

            {/* PRICING */}
            <Panel
              eyebrow="Pricing"
              title="Price & charge model"
              icon={<Banknote className="h-3.5 w-3.5" />}
            >
              <div className="space-y-5">
                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    How is it charged?
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PRICING_MODELS.map((m) => {
                      const mMeta = PRICING_MODEL_META[m.value];
                      const selected = pricingModel === m.value;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setPricingModel(m.value);
                            touch();
                          }}
                          aria-pressed={selected}
                          className={`flex flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2.5 text-left transition-all ${
                            selected
                              ? "border-brand-primary bg-brand-accent/60 shadow-[inset_0_0_0_1px_#10B981]"
                              : "border-brand-line bg-white hover:border-brand-primary/40"
                          }`}
                        >
                          <span className="text-[12px] font-semibold text-brand-ink">
                            {mMeta.label}
                          </span>
                          <span className="text-[10.5px] text-brand-mute">
                            {mMeta.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="text-[12px] font-semibold text-brand-ink">
                      Price
                    </label>
                    <p className="mt-0.5 text-[11.5px] text-brand-mute">
                      Amount per unit ({addon.currency}).
                    </p>
                    <div className="mt-2 flex items-stretch">
                      <div className="flex items-center rounded-l-[10px] border border-r-0 border-brand-line bg-brand-light/60 px-3 text-[12.5px] font-medium text-brand-mute">
                        R
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={unitPrice}
                        onChange={(e) => {
                          setUnitPrice(e.target.value);
                          touch();
                        }}
                        className="min-w-0 flex-1 border border-brand-line bg-white px-3 py-2.5 text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                      />
                      <div className="flex items-center rounded-r-[10px] border border-l-0 border-brand-line bg-brand-light/60 px-3 text-[11px] text-brand-mute">
                        {meta.suffix}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-brand-ink">
                      Max quantity per stay
                    </label>
                    <p className="mt-0.5 text-[11.5px] text-brand-mute">
                      Blank or 0 = no limit.
                    </p>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={maxQuantity}
                      onChange={(e) => {
                        setMaxQuantity(e.target.value);
                        touch();
                      }}
                      placeholder="No limit"
                      className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2.5 text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[10px] border border-brand-line px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
                      <Percent className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="text-[13px] font-medium text-brand-ink">
                        VAT included
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        Price shown to guests already includes 15% VAT
                      </div>
                    </div>
                  </div>
                  <Toggle
                    checked={vatIncluded}
                    onChange={() => {
                      setVatIncluded((v) => !v);
                      touch();
                    }}
                    label="Toggle VAT included"
                  />
                </div>
              </div>
            </Panel>

            {/* AVAILABILITY */}
            <Panel
              eyebrow="Availability"
              title="Where & when it's offered"
              icon={<Layers className="h-3.5 w-3.5" />}
            >
              <div className="space-y-5">
                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    Lead time
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Notice needed before arrival.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LEAD_TIME_OPTIONS.map((opt) => {
                      const selected = leadTimeDays === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setLeadTimeDays(opt.value);
                            touch();
                          }}
                          aria-pressed={selected}
                          className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                            selected
                              ? "border-brand-primary bg-brand-accent text-brand-secondary"
                              : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" /> {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    Daily capacity
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Max units you can fulfil per day. Blank = unlimited.
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={dailyCapacity}
                    onChange={(e) => {
                      setDailyCapacity(e.target.value);
                      touch();
                    }}
                    placeholder="Unlimited"
                    className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2.5 text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)] sm:max-w-[12rem]"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    Applies to rooms
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Choose which listings &amp; rooms offer this add-on.
                  </p>
                  {availability.listings.length === 0 ? (
                    <div className="mt-2 rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3.5 py-3 text-[12px] text-brand-mute">
                      Add a published listing to offer this add-on.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2.5">
                      {availability.listings.map((listing) => {
                        const sel = selections[listing.id] ?? {
                          mode: "off" as const,
                          roomIds: [],
                        };
                        const hasRooms = listing.rooms.length > 0;
                        const modeOptions: {
                          value: ListingMode;
                          label: string;
                        }[] = hasRooms
                          ? [
                              { value: "off", label: "Not offered" },
                              { value: "all", label: "All rooms" },
                              { value: "rooms", label: "Specific rooms" },
                            ]
                          : [
                              { value: "off", label: "Not offered" },
                              { value: "all", label: "All rooms" },
                            ];
                        return (
                          <div
                            key={listing.id}
                            className="rounded-[12px] border border-brand-line bg-white px-3.5 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0 truncate text-[13px] font-semibold text-brand-ink">
                                {listing.name}
                              </div>
                              <div className="inline-flex rounded-[10px] border border-brand-line bg-brand-light/50 p-0.5">
                                {modeOptions.map((opt) => {
                                  const active = sel.mode === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      disabled={availPending}
                                      aria-pressed={active}
                                      onClick={() =>
                                        setListingMode(listing, opt.value)
                                      }
                                      className={`rounded-[8px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-60 ${
                                        active
                                          ? "bg-brand-primary text-white shadow-sm"
                                          : "text-brand-mute hover:text-brand-ink"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {sel.mode === "rooms" && hasRooms ? (
                              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-brand-line pt-2.5">
                                {listing.rooms.map((room) => {
                                  const on = sel.roomIds.includes(room.id);
                                  return (
                                    <button
                                      key={room.id}
                                      type="button"
                                      disabled={availPending}
                                      aria-pressed={on}
                                      onClick={() =>
                                        toggleRoom(listing.id, room.id)
                                      }
                                      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60 ${
                                        on
                                          ? "border-brand-primary bg-brand-primary text-white"
                                          : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
                                      }`}
                                    >
                                      {on ? (
                                        <Check className="h-3 w-3" />
                                      ) : null}
                                      {room.name}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-brand-ink">
                    When can guests add it?
                  </label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between rounded-[10px] border border-brand-primary/30 bg-brand-accent/30 px-3.5 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-brand-ink">
                          During checkout
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-secondary">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                        Active
                      </span>
                    </div>
                    <ComingSoonChannel
                      icon={<Mail className="h-3.5 w-3.5" />}
                      label="Pre-arrival email"
                    />
                    <ComingSoonChannel
                      icon={<Clock className="h-3.5 w-3.5" />}
                      label="During the stay"
                    />
                  </div>
                </div>
              </div>
            </Panel>

            {/* PHOTO */}
            <Panel
              id="sec-media"
              eyebrow="Photo"
              title="Add-on image"
              icon={<ImageIcon className="h-3.5 w-3.5" />}
              description="A good photo makes guests far more likely to add it."
            >
              <div className="space-y-4">
                <AddonImageInput
                  addonId={addon.id}
                  imageUrl={imageUrl}
                  onChange={(url) => {
                    setImageUrl(url);
                    touch();
                  }}
                />

                {/* guest preview */}
                <div className="rounded-card border border-brand-line">
                  <div className="flex items-center justify-between border-b border-brand-line px-4 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                      Guest preview
                    </div>
                    <span className="text-[10.5px] text-brand-mute">
                      at checkout
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 rounded-[12px] border border-brand-line p-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-brand-accent/40">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-brand-mute">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-[13.5px] font-bold text-brand-ink">
                          {displayName}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-brand-mute">
                          {description.trim() ||
                            "Add a short description guests will see."}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1">
                          <span className="font-display text-[13.5px] font-bold text-brand-ink">
                            {zar(safePrice)}
                          </span>
                          <span className="text-[11px] text-brand-mute">
                            {meta.suffix}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-primary bg-brand-accent/40 px-4 py-2.5 text-[13px] font-semibold text-brand-secondary">
                      <Plus className="h-4 w-4" /> Add to booking
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            {/* DELETE */}
            <Panel
              eyebrow="Danger zone"
              title="Delete add-on"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              description="Removes this add-on from every listing it's attached to. This can't be undone."
            >
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletePending}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-status-cancelled/30 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-status-cancelled transition-colors hover:bg-status-cancelled/5 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deletePending ? "Deleting…" : "Delete add-on"}
              </button>
            </Panel>
          </div>

          {/* ----- RIGHT: sticky rail ----- */}
          <div className="space-y-5">
            <div className="space-y-5 lg:sticky lg:top-6">
              {/* completeness */}
              <section className="rounded-card border border-brand-line bg-white shadow-card">
                <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                  <ProgressRing pct={checklist.pct} />
                  <div>
                    <div className="font-display text-[14px] font-bold text-brand-ink">
                      {checklist.allDone ? "Ready to publish" : "Almost ready"}
                    </div>
                    <div className="text-[11.5px] text-brand-mute">
                      {checklist.allDone
                        ? "All set — guests can book this"
                        : "Finish the steps below"}
                    </div>
                  </div>
                </div>
                <ul className="space-y-1 px-3 py-3 text-[12.5px]">
                  {checklist.items.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          item.done
                            ? "bg-brand-primary text-white"
                            : "border border-brand-line bg-white text-brand-mute"
                        }`}
                      >
                        {item.done ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span
                        className={
                          item.done ? "text-brand-ink" : "text-brand-mute"
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* tip */}
              <section className="rounded-card border border-brand-line bg-brand-accent/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-brand-secondary">
                    <Lightbulb className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[12.5px] font-semibold text-brand-ink">
                      A photo lifts uptake
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-brand-mute">
                      Add-ons with a clear photo and a one-line description are
                      added far more often at checkout. Keep the name short and
                      specific.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Sticky save bar (on unsaved changes) ===== */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-white shadow-lift">
          <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[14px] font-bold text-brand-ink">
                {displayName}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-status-pending">
                <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                Unsaved changes
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setDirty(false);
                setName(addon.name);
                setDescription(addon.description);
                setCategory(addon.category);
                setPricingModel(addon.pricingModel);
                setUnitPrice(addon.unitPrice ? String(addon.unitPrice) : "0");
                setMaxQuantity(
                  addon.maxQuantity == null ? "" : String(addon.maxQuantity),
                );
                setLeadTimeDays(addon.leadTimeDays);
                setDailyCapacity(
                  addon.dailyCapacity == null
                    ? ""
                    : String(addon.dailyCapacity),
                );
                setIsRequired(addon.isRequired);
                setVatIncluded(addon.vatIncluded);
              }}
              className="inline-flex items-center rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-light/60"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={savePending}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {savePending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- small building blocks ---------- */

function HeroFact({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
        {label}
      </div>
      <div className="mt-1 truncate font-display text-xl font-bold text-white">
        {value}
      </div>
      <div className="text-[10px] text-brand-accent/60">{sub}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-pill transition-colors disabled:opacity-60 ${
        checked ? "bg-brand-primary" : "bg-brand-line"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ComingSoonChannel({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-[10px] border border-brand-line bg-brand-light/40 px-3.5 py-2.5 opacity-70">
      <span className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-brand-line/40 text-brand-mute">
          {icon}
        </span>
        <span className="text-[13px] font-medium text-brand-mute">{label}</span>
      </span>
      <span className="rounded-pill bg-brand-line/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        Coming soon
      </span>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-12 w-12">
      <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#DCEAE0"
          strokeWidth="3.2"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[12px] font-bold tabular-nums text-brand-ink">
        {pct}%
      </div>
    </div>
  );
}

function Panel({
  id,
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-card border border-brand-line bg-white shadow-card"
    >
      <header className="border-b border-brand-line px-6 py-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {icon}
          {eyebrow}
        </div>
        <h3 className="mt-0.5 font-display text-[16px] font-bold text-brand-ink">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-[11.5px] text-brand-mute">{description}</p>
        ) : null}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}
