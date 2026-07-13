"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Percent,
  Pencil,
  SlidersHorizontal,
  Ticket,
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
import { formatMoney } from "@/lib/format";

import { createCouponAction, updateCouponAction } from "./actions";
import type { CouponAddon, CouponListing } from "./CouponsManager";
import { COUPON_SCOPES, type CouponScope } from "./schemas";

// The editable form fields — numeric inputs stay as strings so a restored draft
// drops straight back into the same setters.
export type CouponEditValues = {
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  scope: CouponScope;
  listingId: string | null;
  roomId: string | null;
  addonId: string | null;
  minNights: string;
  minSpend: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  perGuestLimit: string;
  isActive: boolean;
};

type SectionKey = "details" | "discount" | "limits" | "review";
type SectionDef = { key: SectionKey; label: string; icon: LucideIcon };

const SECTIONS: SectionDef[] = [
  { key: "details", label: "Details", icon: TypeIcon },
  { key: "discount", label: "Discount", icon: Percent },
  { key: "limits", label: "Limits & validity", icon: SlidersHorizontal },
  { key: "review", label: "Review", icon: ClipboardCheck },
];

const PANEL_META: Record<SectionKey, { title: string; desc: string }> = {
  details: {
    title: "Details",
    desc: "The code guests type at checkout, and a private note for you.",
  },
  discount: {
    title: "Discount",
    desc: "How much comes off, and what it applies to.",
  },
  limits: {
    title: "Limits & validity",
    desc: "When it's live and how far it can go. All optional.",
  },
  review: {
    title: "Review",
    desc: "Everything at a glance before it goes live.",
  },
};

const SCOPE_HINT: Record<CouponScope, string> = {
  order: "the whole order (stay + add-ons)",
  accommodation: "the accommodation only",
  addons: "add-ons only",
};

function numOrNull(s: string): number | null {
  return s.trim() === "" ? null : Number(s);
}

const FIELD =
  "w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-[14px] text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)] placeholder:text-brand-mute/70";

export function CouponEditor({
  mode,
  couponId,
  initial,
  listings,
  addons,
  userId,
  serverDraft,
}: {
  mode: "create" | "edit";
  couponId?: string;
  initial: CouponEditValues;
  listings: CouponListing[];
  addons: CouponAddon[];
  userId: string;
  serverDraft: LoadedDraft | null;
}) {
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [section, setSection] = useState<SectionKey>("details");
  const sectionIdx = SECTIONS.findIndex((s) => s.key === section);

  const [code, setCode] = useState(initial.code);
  const [description, setDescription] = useState(initial.description);
  const [discountType, setDiscountType] = useState(initial.discountType);
  const [discountValue, setDiscountValue] = useState(initial.discountValue);
  const [scope, setScope] = useState<CouponScope>(initial.scope);
  const [listingId, setListingId] = useState<string | null>(initial.listingId);
  const [roomId, setRoomId] = useState<string | null>(initial.roomId);
  const [addonId, setAddonId] = useState<string | null>(initial.addonId);
  const [minNights, setMinNights] = useState(initial.minNights);
  const [minSpend, setMinSpend] = useState(initial.minSpend);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [maxRedemptions, setMaxRedemptions] = useState(initial.maxRedemptions);
  const [perGuestLimit, setPerGuestLimit] = useState(initial.perGuestLimit);
  const [isActive, setIsActive] = useState(initial.isActive);

  const [dirty, setDirty] = useState(false);
  function touch() {
    if (!dirty) setDirty(true);
  }

  const listing = useMemo(
    () => listings.find((l) => l.id === listingId) ?? null,
    [listings, listingId],
  );
  const currency = listing?.currency ?? listings[0]?.currency ?? "ZAR";

  // ---- Auto-save drafts ----
  const draftValue = useMemo<CouponEditValues>(
    () => ({
      code,
      description,
      discountType,
      discountValue,
      scope,
      listingId,
      roomId,
      addonId,
      minNights,
      minSpend,
      startsAt,
      endsAt,
      maxRedemptions,
      perGuestLimit,
      isActive,
    }),
    [
      code,
      description,
      discountType,
      discountValue,
      scope,
      listingId,
      roomId,
      addonId,
      minNights,
      minSpend,
      startsAt,
      endsAt,
      maxRedemptions,
      perGuestLimit,
      isActive,
    ],
  );

  const applyDraft = useCallback((p: CouponEditValues) => {
    setCode(p.code);
    setDescription(p.description);
    setDiscountType(p.discountType);
    setDiscountValue(p.discountValue);
    setScope(p.scope);
    setListingId(p.listingId);
    setRoomId(p.roomId);
    setAddonId(p.addonId);
    setMinNights(p.minNights);
    setMinSpend(p.minSpend);
    setStartsAt(p.startsAt);
    setEndsAt(p.endsAt);
    setMaxRedemptions(p.maxRedemptions);
    setPerGuestLimit(p.perGuestLimit);
    setIsActive(p.isActive);
    setDirty(true);
    toast.success("Draft restored");
  }, []);

  const draftTarget = useMemo(
    () => ({
      entityType: "coupon" as const,
      entityId: couponId ?? null,
      scopeId: null,
    }),
    [couponId],
  );

  const draft = useAutosaveDraft({
    userId,
    target: draftTarget,
    value: draftValue,
    onRestore: applyDraft,
    serverDraft,
  });

  // ---- Derived: worked economics for the guest preview ----
  const valueNum = Number(discountValue);
  const safeValue = Number.isFinite(valueNum) && valueNum > 0 ? valueNum : 0;
  const SAMPLE_STAY = 2000;
  const SAMPLE_ADDONS = 400;
  const eligibleBase =
    scope === "addons"
      ? SAMPLE_ADDONS
      : scope === "accommodation"
        ? SAMPLE_STAY
        : SAMPLE_STAY + SAMPLE_ADDONS;
  const sampleDiscount =
    discountType === "percent"
      ? Math.round(((eligibleBase * safeValue) / 100) * 100) / 100
      : Math.min(safeValue, eligibleBase);
  const sampleOrder = SAMPLE_STAY + SAMPLE_ADDONS;
  const discountLabel =
    discountType === "percent"
      ? `${safeValue || 0}% off`
      : `${formatMoney(safeValue, currency)} off`;

  const codeUpper = code.trim().toUpperCase();
  const displayCode = codeUpper || "YOURCODE";

  // ---- Targeting label ----
  const room = listing?.rooms.find((r) => r.id === roomId) ?? null;
  const addon = addons.find((a) => a.id === addonId) ?? null;
  const targetLabel = listing
    ? `${listing.name}${room ? ` · ${room.name}` : ""}`
    : "All listings";

  // ---- Validity status ----
  const todayStr = new Date().toISOString().slice(0, 10);
  const validityLabel = (() => {
    if (startsAt && startsAt > todayStr) return `Starts ${startsAt}`;
    if (endsAt && endsAt < todayStr) return `Expired ${endsAt}`;
    if (endsAt) return `Until ${endsAt}`;
    return "No end date";
  })();

  // ---- Readiness checklist ----
  const checklist = useMemo(() => {
    const items = [
      { label: "Code set (2+ chars)", done: codeUpper.length >= 2 },
      { label: "Discount value set", done: safeValue > 0 },
      {
        label: "Percent within 100",
        done: discountType !== "percent" || safeValue <= 100,
      },
      {
        label: "Dates in order",
        done: !startsAt || !endsAt || endsAt >= startsAt,
      },
    ];
    const done = items.filter((i) => i.done).length;
    return {
      items,
      pct: Math.round((done / items.length) * 100),
      allDone: done === items.length,
    };
  }, [codeUpper, safeValue, discountType, startsAt, endsAt]);

  function sectionDone(key: SectionKey): boolean {
    switch (key) {
      case "details":
        return codeUpper.length >= 2;
      case "discount":
        return (
          safeValue > 0 && (discountType !== "percent" || safeValue <= 100)
        );
      case "limits":
        return !startsAt || !endsAt || endsAt >= startsAt;
      case "review":
        return checklist.allDone;
    }
  }

  function railSub(key: SectionKey): string {
    switch (key) {
      case "details":
        return codeUpper || "Add a code";
      case "discount":
        return safeValue > 0
          ? `${discountLabel} · ${SCOPE_LABEL[scope]}`
          : "Set the discount";
      case "limits":
        return validityLabel;
      case "review":
        return checklist.allDone ? "Ready to save" : "Finish the basics";
    }
  }

  function buildPayload() {
    return {
      code: codeUpper,
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: safeValue,
      scope,
      property_id: listingId,
      room_id: scope === "accommodation" ? roomId : null,
      addon_id: scope === "addons" ? addonId : null,
      min_nights: numOrNull(minNights),
      min_spend: numOrNull(minSpend),
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      max_redemptions: numOrNull(maxRedemptions),
      per_guest_limit: numOrNull(perGuestLimit),
      is_active: isActive,
    };
  }

  function handleSave() {
    if (codeUpper.length < 2) {
      toast.error("Add a code (at least 2 characters).");
      setSection("details");
      return;
    }
    if (safeValue <= 0) {
      toast.error("Set a discount greater than 0.");
      setSection("discount");
      return;
    }
    if (discountType === "percent" && safeValue > 100) {
      toast.error("A percentage can’t exceed 100.");
      setSection("discount");
      return;
    }
    startSave(async () => {
      const payload = buildPayload();
      const res =
        mode === "create"
          ? await createCouponAction(payload)
          : await updateCouponAction(couponId as string, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      draft.clearSaved();
      setDirty(false);
      toast.success(mode === "create" ? "Coupon created" : "Coupon saved");
      router.push("/dashboard/coupons");
      router.refresh();
    });
  }

  const panelMeta = PANEL_META[section];

  return (
    <div className="space-y-5">
      {draft.hasDraft ? (
        <ResumeDraftBanner
          savedAt={draft.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
          label="coupon changes"
        />
      ) : null}

      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[11px] border border-brand-line bg-brand-light text-brand-secondary">
          <Ticket className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/dashboard/coupons" className="hover:text-brand-ink">
              Coupons
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">
              {mode === "create" ? "New coupon" : "Editing"}
            </span>
          </nav>
          <h1 className="mt-0.5 truncate font-display text-[19px] font-extrabold leading-none tracking-wide text-brand-ink">
            {displayCode}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <span
            className={`mr-1 hidden items-center gap-1.5 text-[12px] md:inline-flex ${
              dirty ? "text-status-pending" : "text-brand-mute"
            }`}
          >
            {draft.status === "saving" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                Saving draft…
              </>
            ) : dirty ? (
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
            href="/dashboard/coupons"
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            Cancel
          </Link>
          {/* The Review step has its own primary CTA, so the identity bar shows
              the Create/Save button on every step EXCEPT the last — never two. */}
          {section !== "review" ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={savePending}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {savePending
                ? "Saving…"
                : mode === "create"
                  ? "Create coupon"
                  : "Save coupon"}
            </button>
          ) : null}
        </div>
      </div>

      {/* ============ SPLIT: rail + panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[288px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 shadow-card">
            <ProgressRing pct={checklist.pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {checklist.allDone ? "Ready to save" : "Almost ready"}
              </div>
              <div className="text-[11px] text-brand-mute">
                {checklist.allDone
                  ? "Guests can redeem this"
                  : "Finish the steps below"}
              </div>
            </div>
          </div>

          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Steps
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

          {/* docked guest preview — the discount as it lands at checkout */}
          <div className="mt-4">
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Guest preview · at checkout
            </div>
            <div className="rounded-card border border-brand-line bg-white p-3 shadow-card">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-accent text-brand-secondary">
                  <Ticket className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[13px] font-bold tracking-wide text-brand-ink">
                    {displayCode}
                  </div>
                  <div className="text-[10.5px] text-brand-mute">
                    {discountLabel} · {SCOPE_LABEL[scope].toLowerCase()}
                  </div>
                </div>
                <span className="rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-bold text-status-confirmed">
                  Applied
                </span>
              </div>
              <div className="mt-2.5 space-y-1 border-t border-brand-line pt-2 text-[11px]">
                <div className="flex justify-between text-brand-mute">
                  <span>Order subtotal</span>
                  <span className="tabular-nums">
                    {formatMoney(sampleOrder, currency)}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-brand-primary">
                  <span>Coupon {displayCode}</span>
                  <span className="tabular-nums">
                    − {formatMoney(sampleDiscount, currency)}
                  </span>
                </div>
                <div className="flex justify-between font-display font-bold text-brand-ink">
                  <span>Guest pays</span>
                  <span className="tabular-nums">
                    {formatMoney(sampleOrder - sampleDiscount, currency)}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 text-[10px] text-brand-mute">
                Example on a {formatMoney(SAMPLE_STAY, currency)} stay +{" "}
                {formatMoney(SAMPLE_ADDONS, currency)} extras.
              </div>
            </div>
          </div>
        </aside>

        {/* ============ ACTIVE PANEL ============ */}
        <div className="min-w-0">
          <div className="mb-5 flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
              {(() => {
                const Icon =
                  SECTIONS.find((s) => s.key === section)?.icon ?? TypeIcon;
                return <Icon className="h-5 w-5" />;
              })()}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-extrabold leading-tight text-brand-ink">
                {panelMeta.title}
              </h2>
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
                    Coupon code
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    What guests type at checkout. Letters, numbers, - and _.
                  </p>
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      touch();
                    }}
                    maxLength={40}
                    placeholder="WELCOME10"
                    className={`${FIELD} mt-2 font-mono tracking-wide`}
                  />
                </div>
                <div className="p-5">
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Internal note
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Only you see this — a reminder of what the code is for.
                  </p>
                  <input
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      touch();
                    }}
                    maxLength={200}
                    placeholder="Returning guests · winter"
                    className={`${FIELD} mt-2`}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <div className="text-[13px] font-medium text-brand-ink">
                      Active
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      {isActive
                        ? "Guests can redeem this code now."
                        : "Saved but hidden — guests can’t redeem it."}
                    </div>
                  </div>
                  <Toggle
                    checked={isActive}
                    onChange={() => {
                      setIsActive((v) => !v);
                      touch();
                    }}
                    label="Toggle active"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- DISCOUNT ----- */}
          {section === "discount" ? (
            <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="grid gap-5 border-b border-brand-line p-5 sm:grid-cols-2">
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Discount type
                  </label>
                  <div className="mt-2 flex gap-2">
                    {(["percent", "fixed"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setDiscountType(t);
                          touch();
                        }}
                        aria-pressed={discountType === t}
                        className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-semibold transition ${
                          discountType === t
                            ? "border-brand-primary bg-brand-accent text-brand-secondary"
                            : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
                        }`}
                      >
                        {t === "percent" ? "% off" : "Amount off"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    {discountType === "percent"
                      ? "Percentage"
                      : `Amount (${currency})`}
                  </label>
                  <div className="mt-2 flex items-stretch">
                    <div className="flex items-center rounded-l-[10px] border border-r-0 border-brand-line bg-brand-light/60 px-3 font-mono text-[12.5px] text-brand-mute">
                      {discountType === "percent" ? "%" : "R"}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={discountType === "percent" ? "1" : "0.01"}
                      value={discountValue}
                      onChange={(e) => {
                        setDiscountValue(e.target.value);
                        touch();
                      }}
                      className="min-w-0 flex-1 rounded-r-[10px] border border-brand-line bg-white px-3 py-2.5 font-mono text-[14px] font-semibold text-brand-ink outline-none transition-shadow focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                    />
                  </div>
                  {discountType === "percent" && safeValue > 100 ? (
                    <p className="mt-1 text-[11px] text-status-cancelled">
                      A percentage can’t exceed 100.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="border-b border-brand-line p-5">
                <label className="text-[12.5px] font-semibold text-brand-ink">
                  Applies to
                </label>
                <p className="mt-0.5 text-[11.5px] text-brand-mute">
                  The discount comes off {SCOPE_HINT[scope]}.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COUPON_SCOPES.map((s) => {
                    const selected = scope === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          setScope(s.value);
                          if (s.value !== "accommodation") setRoomId(null);
                          if (s.value !== "addons") setAddonId(null);
                          touch();
                        }}
                        aria-pressed={selected}
                        className={`rounded-pill border px-3.5 py-1.5 text-[12.5px] font-medium transition ${
                          selected
                            ? "border-brand-primary bg-brand-accent text-brand-secondary"
                            : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Listing
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Limit the code to one listing, or leave it for all.
                  </p>
                  <select
                    value={listingId ?? "__all__"}
                    onChange={(e) => {
                      setListingId(
                        e.target.value === "__all__" ? null : e.target.value,
                      );
                      setRoomId(null);
                      touch();
                    }}
                    className={`${FIELD} mt-2`}
                  >
                    <option value="__all__">All my listings</option>
                    {listings.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                {scope === "accommodation" &&
                listing &&
                listing.rooms.length > 0 ? (
                  <div>
                    <label className="text-[12.5px] font-semibold text-brand-ink">
                      Room
                    </label>
                    <p className="mt-0.5 text-[11.5px] text-brand-mute">
                      Narrow it to one room, or any room.
                    </p>
                    <select
                      value={roomId ?? "__any__"}
                      onChange={(e) => {
                        setRoomId(
                          e.target.value === "__any__" ? null : e.target.value,
                        );
                        touch();
                      }}
                      className={`${FIELD} mt-2`}
                    >
                      <option value="__any__">Any room</option>
                      {listing.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {scope === "addons" && addons.length > 0 ? (
                  <div>
                    <label className="text-[12.5px] font-semibold text-brand-ink">
                      Add-on
                    </label>
                    <p className="mt-0.5 text-[11.5px] text-brand-mute">
                      Target one add-on, or any add-on.
                    </p>
                    <select
                      value={addonId ?? "__any__"}
                      onChange={(e) => {
                        setAddonId(
                          e.target.value === "__any__" ? null : e.target.value,
                        );
                        touch();
                      }}
                      className={`${FIELD} mt-2`}
                    >
                      <option value="__any__">Any add-on</option>
                      {addons.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ----- LIMITS ----- */}
          {section === "limits" ? (
            <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="grid gap-5 border-b border-brand-line p-5 sm:grid-cols-2">
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Valid from
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Blank = live immediately.
                  </p>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => {
                      setStartsAt(e.target.value);
                      touch();
                    }}
                    className={`${FIELD} mt-2`}
                  />
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Valid until
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Blank = never expires.
                  </p>
                  <input
                    type="date"
                    value={endsAt}
                    min={startsAt || undefined}
                    onChange={(e) => {
                      setEndsAt(e.target.value);
                      touch();
                    }}
                    className={`${FIELD} mt-2`}
                  />
                </div>
              </div>

              <div className="grid gap-5 border-b border-brand-line p-5 sm:grid-cols-2">
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Minimum nights
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Only redeemable on stays this long.
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={minNights}
                    onChange={(e) => {
                      setMinNights(e.target.value);
                      touch();
                    }}
                    placeholder="Any"
                    className={`${FIELD} mt-2`}
                  />
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Minimum spend
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Eligible total must reach this first.
                  </p>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={minSpend}
                    onChange={(e) => {
                      setMinSpend(e.target.value);
                      touch();
                    }}
                    placeholder="None"
                    className={`${FIELD} mt-2`}
                  />
                </div>
              </div>

              <div className="grid gap-5 p-5 sm:grid-cols-2">
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Max total redemptions
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    Across all guests. Blank = unlimited.
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={maxRedemptions}
                    onChange={(e) => {
                      setMaxRedemptions(e.target.value);
                      touch();
                    }}
                    placeholder="Unlimited"
                    className={`${FIELD} mt-2`}
                  />
                </div>
                <div>
                  <label className="text-[12.5px] font-semibold text-brand-ink">
                    Per-guest limit
                  </label>
                  <p className="mt-0.5 text-[11.5px] text-brand-mute">
                    How many times one guest can use it.
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={perGuestLimit}
                    onChange={(e) => {
                      setPerGuestLimit(e.target.value);
                      touch();
                    }}
                    placeholder="Unlimited"
                    className={`${FIELD} mt-2`}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* ----- REVIEW ----- */}
          {section === "review" ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                  <ProgressRing pct={checklist.pct} />
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold text-brand-ink">
                      {checklist.allDone ? "Ready to save" : "Almost ready"}
                    </div>
                    <div className="text-[12px] text-brand-mute">
                      {checklist.allDone
                        ? "Guests can redeem this code."
                        : "Fix the flagged items below."}
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

              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <SummaryRow
                  label="Code"
                  value={codeUpper || "Not set"}
                  mono
                  muted={!codeUpper}
                  onEdit={() => setSection("details")}
                />
                <SummaryRow
                  label="Discount"
                  value={`${discountLabel} · ${SCOPE_LABEL[scope]}`}
                  muted={safeValue <= 0}
                  onEdit={() => setSection("discount")}
                />
                <SummaryRow
                  label="Where"
                  value={
                    scope === "addons"
                      ? addon
                        ? `Add-on · ${addon.name}`
                        : "Any add-on"
                      : targetLabel
                  }
                  onEdit={() => setSection("discount")}
                />
                <SummaryRow
                  label="Valid"
                  value={`${startsAt || "now"} → ${endsAt || "no end"}`}
                  onEdit={() => setSection("limits")}
                />
                <SummaryRow
                  label="Limits"
                  value={
                    [
                      minNights ? `${minNights}+ nights` : null,
                      minSpend
                        ? `min ${formatMoney(Number(minSpend), currency)}`
                        : null,
                      maxRedemptions ? `${maxRedemptions} total` : null,
                      perGuestLimit ? `${perGuestLimit}/guest` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No limits"
                  }
                  muted={
                    !minNights && !minSpend && !maxRedemptions && !perGuestLimit
                  }
                  onEdit={() => setSection("limits")}
                />
                <SummaryRow
                  label="Status"
                  value={isActive ? "Active" : "Off (hidden)"}
                  muted={!isActive}
                  onEdit={() => setSection("details")}
                  last
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {mode === "create"
                      ? "Create this coupon"
                      : "Save your changes"}
                  </div>
                  <div className="text-[12px] text-brand-mute">
                    The server re-validates every redemption at checkout.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={savePending}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {savePending
                    ? "Saving…"
                    : mode === "create"
                      ? "Create coupon"
                      : "Save coupon"}
                </button>
              </div>
            </div>
          ) : null}

          {/* ----- PANEL FOOTER NAV ----- */}
          {section !== "review" ? (
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
              <button
                type="button"
                onClick={() => setSection(SECTIONS[sectionIdx + 1].key)}
                className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
              >
                Continue · {SECTIONS[sectionIdx + 1].label}{" "}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-7 border-t border-brand-line pt-5">
              <button
                type="button"
                onClick={() => setSection("limits")}
                className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
              >
                <ArrowLeft className="h-4 w-4" /> Limits &amp; validity
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SCOPE_LABEL: Record<CouponScope, string> = {
  order: "Whole order",
  accommodation: "Accommodation",
  addons: "Add-ons",
};

/* ---------- small building blocks ---------- */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-pill transition-colors ${
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

function SummaryRow({
  label,
  value,
  mono,
  muted,
  last,
  onEdit,
}: {
  label: string;
  value: string;
  mono?: boolean;
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
      <div className="w-24 shrink-0 text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-[13px] ${
          muted ? "italic text-brand-mute" : "font-medium text-brand-ink"
        } ${mono ? "font-mono tracking-wide" : ""}`}
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
