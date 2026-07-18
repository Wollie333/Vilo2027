"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Image as ImageIcon,
  Layers,
  Mail,
  Minus,
  PackagePlus,
  Pencil,
  Percent,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ResumeDraftBanner } from "@/components/drafts/ResumeDraftBanner";
import { useAutosaveDraft } from "@/components/drafts/useAutosaveDraft";
import type { LoadedDraft } from "@/lib/drafts/store";
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
  PRICING_LABEL,
  PRICING_MODELS,
  PRICING_MODEL_META,
  computeAddonSubtotal,
  defaultAddonQuantity,
  isPerNightModel,
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
  allowCustomQuantity: boolean;
  stockQuantity: number | null;
  isRequired: boolean;
  isActive: boolean;
  isRefundable: boolean;
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

// ── Section model (one panel visible at a time) ──────────────────────────
type SectionKey =
  | "details"
  | "pricing"
  | "availability"
  | "photo"
  | "review"
  | "danger";

type SectionDef = {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
};

const SECTIONS: SectionDef[] = [
  { key: "details", label: "Details", icon: TypeIcon },
  { key: "pricing", label: "Pricing", icon: Banknote },
  { key: "availability", label: "Availability", icon: Layers },
  { key: "photo", label: "Photo", icon: ImageIcon },
  { key: "review", label: "Review", icon: ClipboardCheck },
  { key: "danger", label: "Danger zone", icon: AlertTriangle, danger: true },
];

const PANEL_META: Record<
  SectionKey,
  { title: string; desc: string; required?: boolean }
> = {
  details: {
    title: "Details",
    desc: "What guests see in the extras list — name it well and sell it in a sentence.",
    required: true,
  },
  pricing: {
    title: "Pricing",
    desc: "How it's charged. Your payout always equals what the guest pays.",
  },
  availability: {
    title: "Availability",
    desc: "Where it shows up and when guests can add it.",
  },
  photo: {
    title: "Photo",
    desc: "A good photo makes guests far more likely to add it.",
  },
  review: {
    title: "Review",
    desc: "Everything at a glance before it goes live to guests.",
  },
  danger: {
    title: "Danger zone",
    desc: "These actions change whether guests can see and book this add-on.",
  },
};

function zar(v: number): string {
  return `R ${(Number.isFinite(v) ? v : 0).toLocaleString("en-ZA")}`;
}

/** How many "units" the guest is charged for beyond nights (guests / couples). */
function guestFactorOf(model: PricingModel, guests: number): number {
  if (model === "per_guest" || model === "per_guest_per_night") {
    return Math.max(1, guests);
  }
  if (model === "per_couple") return Math.max(1, Math.ceil(guests / 2));
  return 1;
}

type AddonMath = { total: number; qty: number; parts: string[] };

/**
 * Worked economics for a representative stay — mirrors the checkout math exactly
 * (`computeAddonSubtotal` with the default selected quantity), so the host sees
 * what the guest is actually charged, broken into human-readable factors.
 */
function buildAddonMath(
  model: PricingModel,
  unitPrice: number,
  minQuantity: number,
  nights: number,
  guests: number,
): AddonMath {
  const qty = defaultAddonQuantity(model, minQuantity, nights);
  const total = computeAddonSubtotal(model, unitPrice, qty, guests);
  const parts: string[] = [zar(unitPrice)];
  if (isPerNightModel(model)) {
    parts.push(`${nights} night${nights === 1 ? "" : "s"}`);
  } else if (qty > 1) {
    parts.push(`${qty} unit${qty === 1 ? "" : "s"}`);
  }
  if (model === "per_guest" || model === "per_guest_per_night") {
    parts.push(`${guests} guest${guests === 1 ? "" : "s"}`);
  } else if (model === "per_couple") {
    const couples = guestFactorOf(model, guests);
    parts.push(`${couples} couple${couples === 1 ? "" : "s"}`);
  }
  return { total, qty, parts };
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

// The fields lost on navigate-away (they only persist on an explicit Save).
// Numeric fields stay as their input strings so a restore drops straight back
// into the same setters. Image / active / availability persist immediately via
// their own actions, so they're deliberately excluded.
type AddonDraftPayload = {
  name: string;
  description: string;
  category: AddonCategory | null;
  pricingModel: PricingModel;
  unitPrice: string;
  minQuantity: string;
  maxQuantity: string;
  allowCustomQuantity: boolean;
  stockQuantity: string;
  leadTimeDays: number;
  dailyCapacity: string;
  vatIncluded: boolean;
  isRefundable?: boolean;
};

export function AddonEditor({
  addon,
  availability,
  userId,
  serverDraft,
}: {
  addon: AddonEditModel;
  availability: AddonAvailability;
  userId: string;
  serverDraft: LoadedDraft | null;
}) {
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [availPending, startAvail] = useTransition();

  const [section, setSection] = useState<SectionKey>("details");
  const sectionIdx = SECTIONS.findIndex((s) => s.key === section);
  const isLastSection = sectionIdx === SECTIONS.length - 1;

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
  const [minQuantity, setMinQuantity] = useState(
    String(Math.max(1, addon.minQuantity)),
  );
  const [maxQuantity, setMaxQuantity] = useState(
    addon.maxQuantity == null ? "" : String(addon.maxQuantity),
  );
  const [allowCustomQuantity, setAllowCustomQuantity] = useState(
    addon.allowCustomQuantity,
  );
  const [stockQuantity, setStockQuantity] = useState(
    addon.stockQuantity == null ? "" : String(addon.stockQuantity),
  );
  const [leadTimeDays, setLeadTimeDays] = useState(addon.leadTimeDays);
  const [dailyCapacity, setDailyCapacity] = useState(
    addon.dailyCapacity == null ? "" : String(addon.dailyCapacity),
  );
  // Preserved as-is on save; the redesigned editor has no "required" toggle.
  const [isRequired] = useState(addon.isRequired);
  const [isActive, setIsActive] = useState(addon.isActive);
  const [isRefundable, setIsRefundable] = useState(addon.isRefundable);
  const [vatIncluded, setVatIncluded] = useState(addon.vatIncluded);
  const [imageUrl, setImageUrl] = useState<string | null>(addon.imageUrl);

  // Interactive "what the guest pays" example — lets the host feel out how their
  // pricing model scales across a real stay (esp. per-guest / per-couple models).
  const [exNights, setExNights] = useState(2);
  const [exGuests, setExGuests] = useState(2);

  const [dirty, setDirty] = useState(false);
  function touch() {
    if (!dirty) setDirty(true);
  }

  // ---- Auto-save drafts (zero-loss recovery) ----
  const draftValue = useMemo<AddonDraftPayload>(
    () => ({
      name,
      description,
      category,
      pricingModel,
      unitPrice,
      minQuantity,
      maxQuantity,
      allowCustomQuantity,
      stockQuantity,
      leadTimeDays,
      dailyCapacity,
      vatIncluded,
      isRefundable,
    }),
    [
      name,
      description,
      category,
      pricingModel,
      unitPrice,
      minQuantity,
      maxQuantity,
      allowCustomQuantity,
      stockQuantity,
      leadTimeDays,
      dailyCapacity,
      vatIncluded,
      isRefundable,
    ],
  );

  const applyDraft = useCallback((p: AddonDraftPayload) => {
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setPricingModel(p.pricingModel);
    setUnitPrice(p.unitPrice);
    setMinQuantity(p.minQuantity);
    setMaxQuantity(p.maxQuantity);
    setAllowCustomQuantity(p.allowCustomQuantity);
    setStockQuantity(p.stockQuantity);
    setLeadTimeDays(p.leadTimeDays);
    setDailyCapacity(p.dailyCapacity);
    setVatIncluded(p.vatIncluded);
    setIsRefundable(p.isRefundable ?? true);
    setDirty(true);
    toast.success("Draft restored");
  }, []);

  const draftTarget = useMemo(
    () => ({ entityType: "addon" as const, entityId: addon.id, scopeId: null }),
    [addon.id],
  );

  const draft = useAutosaveDraft({
    userId,
    target: draftTarget,
    value: draftValue,
    onRestore: applyDraft,
    serverDraft,
  });

  const meta = PRICING_MODEL_META[pricingModel];
  const priceNum = Number(unitPrice);
  const safePrice = Number.isFinite(priceNum) ? priceNum : 0;
  const minQ = Math.max(1, Number(minQuantity) || 1);

  // Live worked economics for the chosen example stay — the exact checkout math.
  const math = buildAddonMath(
    pricingModel,
    safePrice,
    minQ,
    exNights,
    exGuests,
  );
  const stockNum =
    stockQuantity.trim() === ""
      ? null
      : Math.max(0, Number(stockQuantity) || 0);
  const categoryLabel = category ? ADDON_CATEGORY_LABEL[category] : null;

  // How many listings currently offer this add-on (drives the rail subtitle).
  const offeredCount = useMemo(
    () => Object.values(selections).filter((s) => s.mode !== "off").length,
    [selections],
  );

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

  // Per-section completion → check badge in the rail nav.
  function sectionDone(key: SectionKey): boolean {
    switch (key) {
      case "details":
        return name.trim().length > 0 && category != null;
      case "pricing":
        return safePrice > 0;
      case "availability":
        return offeredCount > 0;
      case "photo":
        return imageUrl != null;
      case "review":
        return checklist.allDone;
      default:
        return false;
    }
  }

  function railSub(key: SectionKey): string {
    switch (key) {
      case "details":
        return "Name, category, copy";
      case "pricing":
        return `${zar(safePrice)} ${meta.suffix}`;
      case "availability":
        return offeredCount === 0
          ? "Not offered yet"
          : `${offeredCount} listing${offeredCount === 1 ? "" : "s"}`;
      case "photo":
        return imageUrl ? "1 selected" : "None yet";
      case "review":
        return checklist.allDone ? "Ready to publish" : "Finish the basics";
      case "danger":
        return "Archive · delete";
    }
  }

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
        min_quantity: minQuantity.trim() === "" ? 1 : Number(minQuantity),
        max_quantity: maxQuantity.trim() === "" ? null : Number(maxQuantity),
        allow_custom_quantity: allowCustomQuantity,
        stock_quantity:
          stockQuantity.trim() === "" ? null : Number(stockQuantity),
        is_required: isRequired,
        is_active: isActive,
        is_refundable: isRefundable,
        lead_time_days: leadTimeDays,
        category,
        vat_included: vatIncluded,
        daily_capacity:
          dailyCapacity.trim() === "" ? null : Number(dailyCapacity),
      });
      if (result.ok) {
        toast.success("Add-on saved");
        setDirty(false);
        draft.clearSaved();
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
      } else {
        toast.success(next ? "Add-on is live to guests" : "Moved to drafts");
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
  const panelMeta = PANEL_META[section];

  return (
    <div className="space-y-5">
      {draft.hasDraft ? (
        <ResumeDraftBanner
          savedAt={draft.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
          label="add-on changes"
        />
      ) : null}

      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[11px] border border-brand-line bg-brand-light">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-mute">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/dashboard/addons" className="hover:text-brand-ink">
              Add-ons
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">Editing</span>
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
              {isActive ? "Active" : "Draft"}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-pill border border-brand-line bg-brand-light/60 px-3 py-1.5 lg:flex">
            <span className="text-[12px] font-semibold text-brand-ink">
              {togglePending ? "Saving…" : isActive ? "Active" : "Draft"}
            </span>
            <Toggle
              checked={isActive}
              onChange={handleToggleActive}
              disabled={togglePending}
              label="Toggle active"
            />
          </div>
          <span
            className={`mr-1 hidden items-center gap-1.5 text-[12px] md:inline-flex ${
              dirty ? "text-status-pending" : "text-brand-mute"
            }`}
          >
            {dirty ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                Unsaved changes
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-brand-primary" /> Saved
              </>
            )}
          </span>
          <Link
            href="/dashboard/addons"
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={savePending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {savePending ? "Saving…" : "Save add-on"}
          </button>
        </div>
      </div>

      {/* ============ SPLIT: section rail + active panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[288px_1fr]">
        {/* section navigator */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {/* health summary */}
          <div className="mb-3 flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card">
            <ProgressRing pct={checklist.pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {checklist.allDone ? "Ready to publish" : "Almost ready"}
              </div>
              <div className="text-[11px] text-brand-mute">
                {checklist.allDone
                  ? "Guests can book this"
                  : "Finish the steps below"}
              </div>
            </div>
          </div>

          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Sections
          </div>
          <div className="space-y-1">
            {SECTIONS.map(({ key, label, icon: Icon, danger }) => {
              const isActiveSection = section === key;
              const sub = railSub(key);
              const done = sectionDone(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSection(key)}
                  aria-current={isActiveSection ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                    isActiveSection
                      ? danger
                        ? "border-status-cancelled/30 bg-status-cancelled/5"
                        : "border-brand-line bg-white shadow-card"
                      : "border-transparent hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
                      isActiveSection
                        ? danger
                          ? "bg-status-cancelled text-white"
                          : "bg-brand-primary text-white"
                        : danger
                          ? "bg-status-cancelled/10 text-status-cancelled"
                          : "bg-brand-accent/70 text-brand-secondary"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] font-semibold leading-tight ${
                        danger
                          ? "text-status-cancelled"
                          : isActiveSection
                            ? "text-brand-ink"
                            : "text-brand-ink/80"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                      {sub}
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

          {/* docked guest preview — mirrors the real checkout add-on card */}
          <div className="mt-4">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Guest preview · at checkout
            </div>
            <div className="rounded-card border border-brand-primary bg-white p-3 shadow-card">
              <div className="flex gap-3">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                    <PackagePlus className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate font-display text-[13px] font-bold leading-tight text-brand-ink">
                      {displayName}
                    </div>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-brand-primary bg-brand-primary text-white">
                      <Check className="h-3 w-3" />
                    </div>
                  </div>
                  {description.trim() ? (
                    <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-brand-mute">
                      {description.trim()}
                    </div>
                  ) : (
                    <div className="mt-1 line-clamp-2 text-[10.5px] italic leading-snug text-brand-mute/70">
                      Add a short description guests will see.
                    </div>
                  )}
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <div className="text-[11px]">
                      <span className="font-semibold text-brand-ink">
                        {zar(safePrice)}
                      </span>
                      <span className="text-brand-mute">
                        {" "}
                        · {PRICING_LABEL[pricingModel]}
                      </span>
                    </div>
                    {math.total > 0 ? (
                      <div className="font-mono text-[10.5px] text-brand-secondary">
                        = {zar(math.total)}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {categoryLabel ? (
                      <span className="inline-flex rounded-pill bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-mute">
                        {categoryLabel}
                      </span>
                    ) : null}
                    {stockNum != null ? (
                      stockNum <= 0 ? (
                        <span className="inline-flex rounded-pill bg-status-cancelled/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-status-cancelled">
                          Sold out
                        </span>
                      ) : (
                        <span className="inline-flex rounded-pill bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-mute">
                          {stockNum} left
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 border-t border-brand-primary/20 pt-2 text-center text-[10px] text-brand-mute">
                Example · {exNights} night{exNights === 1 ? "" : "s"} ·{" "}
                {exGuests} guest{exGuests === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </aside>

        {/* ============ ACTIVE PANEL ============ */}
        <div className="min-w-0">
          {/* panel header */}
          <div className="mb-5 flex items-start gap-3.5">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
                section === "danger"
                  ? "bg-status-cancelled/10 text-status-cancelled"
                  : "bg-brand-accent text-brand-secondary"
              }`}
            >
              {(() => {
                const Icon =
                  SECTIONS.find((s) => s.key === section)?.icon ?? TypeIcon;
                return <Icon className="h-5 w-5" />;
              })()}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2
                  className={`font-display text-[22px] font-extrabold leading-tight ${
                    section === "danger"
                      ? "text-status-cancelled"
                      : "text-brand-ink"
                  }`}
                >
                  {panelMeta.title}
                </h2>
                {panelMeta.required ? (
                  <span className="mt-1 text-[11px] font-medium text-brand-mute">
                    Required
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[13.5px] text-brand-mute">
                {panelMeta.desc}
              </p>
            </div>
          </div>

          {/* ----- DETAILS ----- */}
          {section === "details" ? (
            <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="divide-y divide-[#EEF4F0]">
                <div className="p-5">
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Add-on name
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Shown in the extras list at checkout.
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

                <div className="p-5">
                  <label className="text-[12.5px] font-semibold text-brand-ink">
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

                <div className="p-5">
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Description
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Sell it in a sentence or two.
                  </p>
                  <textarea
                    rows={4}
                    value={description}
                    maxLength={DESC_MAX}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      touch();
                    }}
                    className="mt-2 w-full resize-none rounded-[10px] border border-brand-line bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-brand-mute">
                    <span>Tip: lead with what makes it special.</span>
                    <span className="tabular-nums">
                      {description.length} / {DESC_MAX}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- PRICING ----- */}
          {section === "pricing" ? (
            <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="border-b border-brand-line p-5">
                <label className="text-[12.5px] font-semibold text-brand-ink">
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
                        className={`flex flex-col items-start gap-0.5 rounded-[11px] border px-3 py-2.5 text-left transition-all ${
                          selected
                            ? "border-brand-primary bg-brand-light shadow-[inset_0_0_0_1px_#10B981]"
                            : "border-brand-line bg-white hover:border-brand-primary/40 hover:bg-[#F8FCFA]"
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

              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Price
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Amount per unit ({addon.currency}).
                  </p>
                  <div className="mt-2 flex items-stretch">
                    <div className="flex items-center rounded-l-[10px] border border-r-0 border-brand-line bg-brand-light/60 px-3 font-mono text-[12.5px] text-brand-mute">
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
                      className="min-w-0 flex-1 border border-brand-line bg-white px-3 py-2.5 font-mono text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                    />
                    <div className="flex items-center rounded-r-[10px] border border-l-0 border-brand-line bg-brand-light/60 px-3 font-mono text-[11px] text-brand-mute">
                      {meta.suffix}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Stock available
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Blank = unlimited. Sells out at 0.
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={stockQuantity}
                    onChange={(e) => {
                      setStockQuantity(e.target.value);
                      touch();
                    }}
                    placeholder="Unlimited"
                    className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2.5 font-mono text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                  />
                </div>
              </div>

              {/* Quantity rules */}
              <div className="border-t border-brand-line p-5">
                <div className="rounded-[12px] border border-brand-line p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-medium text-brand-ink">
                        Let guests choose the quantity
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        {allowCustomQuantity
                          ? isPerNightModel(pricingModel)
                            ? "Guests pick how many nights to include."
                            : "Guests pick how many units to add."
                          : "Fixed — applies to the whole stay."}
                      </div>
                    </div>
                    <Toggle
                      checked={allowCustomQuantity}
                      onChange={() => {
                        setAllowCustomQuantity((v) => !v);
                        touch();
                      }}
                      label="Toggle custom quantity"
                    />
                  </div>

                  {allowCustomQuantity ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[12.5px] font-semibold text-brand-ink">
                          Minimum quantity
                        </label>
                        <p className="mt-0.5 text-[11.5px] text-brand-mute">
                          Guests can&apos;t go below this.
                        </p>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={minQuantity}
                          onChange={(e) => {
                            setMinQuantity(e.target.value);
                            touch();
                          }}
                          placeholder="1"
                          className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2.5 font-mono text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                        />
                      </div>
                      <div>
                        <label className="text-[12.5px] font-semibold text-brand-ink">
                          Maximum quantity
                        </label>
                        <p className="mt-0.5 text-[11.5px] text-brand-mute">
                          Blank = no cap (or stock).
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
                          className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2.5 font-mono text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold text-brand-ink">
                        What the guest pays
                      </span>
                      <div className="flex items-center gap-2">
                        <ExStepper
                          value={exNights}
                          min={1}
                          max={30}
                          suffix={exNights === 1 ? "night" : "nights"}
                          onChange={setExNights}
                        />
                        <ExStepper
                          value={exGuests}
                          min={1}
                          max={20}
                          suffix={exGuests === 1 ? "guest" : "guests"}
                          onChange={setExGuests}
                        />
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-end justify-between gap-3">
                      <span className="font-mono text-[11.5px] leading-relaxed text-brand-mute">
                        {math.parts.join(" × ")}
                        {math.parts.length === 1 ? " · flat, once" : ""}
                      </span>
                      <span className="shrink-0 font-display text-[20px] font-extrabold leading-none text-brand-ink">
                        {zar(math.total)}
                      </span>
                    </div>
                    <div className="mt-2 text-[10.5px] text-brand-mute">
                      Shown before VAT · VAT-registered listings add VAT at
                      checkout.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-[12px] border border-brand-line px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                      <Percent className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[13px] font-medium text-brand-ink">
                        VAT included
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        Price shown to guests already includes VAT
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

                <div className="mt-3 flex items-center justify-between rounded-[12px] border border-brand-line px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                      <RotateCcw className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[13px] font-medium text-brand-ink">
                        Refundable on cancellation
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        Off = the guest keeps paying for this even if they
                        cancel (retained before the policy refund)
                      </div>
                    </div>
                  </div>
                  <Toggle
                    checked={isRefundable}
                    onChange={() => {
                      setIsRefundable((v) => !v);
                      touch();
                    }}
                    label="Toggle refundable on cancellation"
                  />
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-brand-light/60 px-3.5 py-3 text-[12px] text-brand-secondary">
                  <Check className="h-4 w-4 shrink-0 text-brand-primary" />
                  <span>
                    Your payout always equals what the guest pays —{" "}
                    <span className="font-semibold">
                      Wielo never charges hosts a fee.
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- AVAILABILITY ----- */}
          {section === "availability" ? (
            <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="grid gap-5 border-b border-brand-line p-5 sm:grid-cols-2">
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
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
                  <label className="text-[12.5px] font-semibold text-brand-ink">
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
                    className="mt-2 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2.5 font-mono text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                  />
                </div>
              </div>

              <div className="border-b border-brand-line p-5">
                <label className="text-[12.5px] font-semibold text-brand-ink">
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
                                    {on ? <Check className="h-3 w-3" /> : null}
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

              <div className="p-5">
                <label className="text-[12.5px] font-semibold text-brand-ink">
                  When can guests add it?
                </label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between rounded-[12px] border border-brand-primary/30 bg-brand-accent/30 px-3.5 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                        <ShoppingCart className="h-4 w-4" />
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
                    icon={<Mail className="h-4 w-4" />}
                    label="Pre-arrival email"
                  />
                  <ComingSoonChannel
                    icon={<Clock className="h-4 w-4" />}
                    label="During the stay"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- PHOTO ----- */}
          {section === "photo" ? (
            <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <AddonImageInput
                addonId={addon.id}
                imageUrl={imageUrl}
                onChange={(url) => {
                  setImageUrl(url);
                  touch();
                }}
              />
              <p className="mt-3 text-[11px] text-brand-mute">
                JPG or PNG · landscape works best · up to 20 MB.
              </p>
            </div>
          ) : null}

          {/* ----- REVIEW ----- */}
          {section === "review" ? (
            <div className="space-y-4">
              {/* readiness */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                  <ProgressRing pct={checklist.pct} />
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold text-brand-ink">
                      {checklist.allDone ? "Ready to publish" : "Almost ready"}
                    </div>
                    <div className="text-[12px] text-brand-mute">
                      {checklist.allDone
                        ? "Everything guests need is set."
                        : "Finish the items below to publish."}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 p-5 sm:grid-cols-2">
                  {checklist.items.map((it) => (
                    <div
                      key={it.label}
                      className="flex items-center gap-2 text-[12.5px]"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          it.done
                            ? "bg-brand-primary text-white"
                            : "bg-brand-light text-brand-mute"
                        }`}
                      >
                        {it.done ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-mute" />
                        )}
                      </span>
                      <span
                        className={
                          it.done ? "text-brand-ink" : "text-brand-mute"
                        }
                      >
                        {it.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* at-a-glance summary with quick-edit jumps */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <SummaryRow
                  label="Name"
                  value={displayName}
                  onEdit={() => setSection("details")}
                />
                <SummaryRow
                  label="Category"
                  value={categoryLabel ?? "None yet"}
                  muted={!categoryLabel}
                  onEdit={() => setSection("details")}
                />
                <SummaryRow
                  label="Description"
                  value={description.trim() || "No description"}
                  muted={!description.trim()}
                  onEdit={() => setSection("details")}
                />
                <SummaryRow
                  label="Price"
                  value={`${zar(safePrice)} · ${PRICING_LABEL[pricingModel]}`}
                  muted={safePrice <= 0}
                  onEdit={() => setSection("pricing")}
                />
                <SummaryRow
                  label={`Example · ${exNights}n · ${exGuests}g`}
                  value={`${math.parts.join(" × ")} = ${zar(math.total)}`}
                  onEdit={() => setSection("pricing")}
                />
                <SummaryRow
                  label="Stock"
                  value={
                    stockNum == null ? "Unlimited" : `${stockNum} available`
                  }
                  muted={stockNum == null}
                  onEdit={() => setSection("pricing")}
                />
                <SummaryRow
                  label="Offered on"
                  value={
                    offeredCount === 0
                      ? "No listings yet"
                      : `${offeredCount} listing${offeredCount === 1 ? "" : "s"}`
                  }
                  muted={offeredCount === 0}
                  onEdit={() => setSection("availability")}
                />
                <SummaryRow
                  label="Photo"
                  value={imageUrl ? "Added" : "None yet"}
                  muted={!imageUrl}
                  onEdit={() => setSection("photo")}
                  last
                />
              </div>

              {/* publish CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {isActive
                      ? "This add-on is live to guests"
                      : "Not published yet"}
                  </div>
                  <div className="text-[12px] text-brand-mute">
                    {isActive
                      ? "Guests can add it at checkout."
                      : checklist.allDone
                        ? "Publish it to start offering it at checkout."
                        : "Finish the checklist, then publish."}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={savePending}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {savePending ? "Saving…" : "Save changes"}
                  </button>
                  {!isActive ? (
                    <button
                      type="button"
                      onClick={handleToggleActive}
                      disabled={togglePending}
                      className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
                    >
                      {togglePending ? "Publishing…" : "Publish"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- DANGER ----- */}
          {section === "danger" ? (
            <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="divide-y divide-brand-line">
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="text-[13px] font-semibold text-brand-ink">
                      {isActive ? "Move to drafts" : "Publish to guests"}
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      {isActive
                        ? "Hide from guests; keep all settings."
                        : "Make this add-on bookable again."}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleActive}
                    disabled={togglePending}
                    className={`rounded-pill border px-3.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-60 ${
                      isActive
                        ? "border-status-pending/30 bg-status-pending/10 text-status-pending hover:bg-status-pending/20"
                        : "border-brand-primary/30 bg-brand-accent text-brand-secondary hover:bg-brand-accent/70"
                    }`}
                  >
                    {isActive ? "Unpublish" : "Publish"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="text-[13px] font-semibold text-brand-ink">
                      Delete add-on
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      Removes it from every listing it&apos;s attached to. This
                      can&apos;t be undone.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deletePending}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-status-cancelled/30 bg-status-cancelled/5 px-3.5 py-1.5 text-[12px] font-semibold text-status-cancelled transition hover:bg-status-cancelled/10 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletePending ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- PANEL FOOTER NAV ----- */}
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
              {sectionIdx + 1} / {SECTIONS.length}
            </span>
            {!isLastSection ? (
              <button
                type="button"
                onClick={() => setSection(SECTIONS[sectionIdx + 1].key)}
                className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
              >
                Continue · {SECTIONS[sectionIdx + 1].label}{" "}
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

/* ---------- small building blocks ---------- */

function ExStepper({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white px-1 py-0.5">
      <button
        type="button"
        aria-label={`Fewer ${suffix}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-5 w-5 items-center justify-center rounded-full text-brand-ink transition hover:bg-brand-accent disabled:opacity-30"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-[3.4rem] text-center text-[11px] font-semibold tabular-nums text-brand-ink">
        {value} {suffix}
      </span>
      <button
        type="button"
        aria-label={`More ${suffix}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-5 w-5 items-center justify-center rounded-full text-brand-ink transition hover:bg-brand-accent disabled:opacity-30"
      >
        <Plus className="h-3 w-3" />
      </button>
    </span>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  last,
  onEdit,
}: {
  label: string;
  value: string;
  muted?: boolean;
  last?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 ${
        last ? "" : "border-b border-[#EEF4F0]"
      }`}
    >
      <div className="w-28 shrink-0 text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-[13px] ${
          muted ? "italic text-brand-mute" : "font-medium text-brand-ink"
        }`}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-mute transition hover:border-brand-primary/40 hover:text-brand-ink"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
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
    <div className="flex items-center justify-between rounded-[12px] border border-brand-line bg-brand-light/40 px-3.5 py-2.5 opacity-70">
      <span className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-line/40 text-brand-mute">
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
