"use client";

import {
  Check,
  ChevronRight,
  ClipboardList,
  Pencil,
  Percent,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ResumeDraftBanner } from "@/components/drafts/ResumeDraftBanner";
import { useAutosaveDraft } from "@/components/drafts/useAutosaveDraft";
import { DatePicker } from "@/components/ui/date-picker";
import { Link } from "@/i18n/navigation";
import type { LoadedDraft } from "@/lib/drafts/store";
import { formatMoney, round2 } from "@/lib/format";

import { upsertPromo } from "./actions";

// Wielo promo-code editor. Mirrors the host CouponEditor's left-rail pattern
// (founder's create-data default layout) but targets PRODUCTS, not stays — so
// there is no listing/room/night targeting here.

export type PromoProduct = {
  id: string;
  name: string;
  productType: string;
  price: number;
  currency: string;
};

export type PromoEditValues = {
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  /** UI-only discriminator; maps to (productId, productType) on save. */
  target: "all" | "product" | "type";
  productId: string | null;
  productType: string | null;
  minSpend: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  perUserLimit: string;
  isActive: boolean;
};

const SECTIONS = [
  { key: "details", label: "Details", icon: Tag },
  { key: "discount", label: "Discount", icon: Percent },
  { key: "limits", label: "Limits & validity", icon: SlidersHorizontal },
  { key: "review", label: "Review", icon: ClipboardList },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const TYPE_LABEL: Record<string, string> = {
  membership: "Memberships",
  service: "Services",
  product: "Once-off products",
  wielo_credits: "Credit packages",
};

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function PromoEditor({
  mode,
  id,
  initial,
  products,
  userId,
  serverDraft,
}: {
  mode: "create" | "edit";
  id?: string;
  initial: PromoEditValues;
  products: PromoProduct[];
  userId: string;
  serverDraft?: LoadedDraft | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<PromoEditValues>(initial);
  const [section, setSection] = useState<SectionKey>("details");
  const [savePending, startSave] = useTransition();
  const [dirty, setDirty] = useState(false);

  const patch = useCallback((p: Partial<PromoEditValues>) => {
    setDirty(true);
    setV((prev) => ({ ...prev, ...p }));
  }, []);

  const draft = useAutosaveDraft<PromoEditValues>({
    userId,
    target: {
      entityType: "platform_coupon",
      entityId: id ?? null,
      scopeId: null,
    },
    value: v,
    onRestore: (restored) => setV(restored),
    serverDraft: serverDraft ?? null,
  });

  const displayCode = v.code.trim().toUpperCase() || "NEW CODE";
  const chosenProduct = products.find((p) => p.id === v.productId) ?? null;

  // ─── Readiness ────────────────────────────────────────────────
  const codeOk = /^[A-Za-z0-9_-]{3,40}$/.test(v.code.trim());
  const value = numOrNull(v.discountValue);
  const discountOk =
    value != null &&
    value > 0 &&
    (v.discountType !== "percent" || value <= 100) &&
    (v.target !== "product" || !!v.productId) &&
    (v.target !== "type" || !!v.productType);
  const datesOk = !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt;

  const checklist = useMemo(() => {
    const items = [codeOk, discountOk, datesOk];
    const done = items.filter(Boolean).length;
    return {
      pct: Math.round((done / items.length) * 100),
      allDone: done === items.length,
    };
  }, [codeOk, discountOk, datesOk]);

  function sectionDone(key: SectionKey): boolean {
    if (key === "details") return codeOk;
    if (key === "discount") return discountOk;
    if (key === "limits") return datesOk;
    return checklist.allDone;
  }

  function railSub(key: SectionKey): string {
    if (key === "details") return v.code.trim() ? displayCode : "No code yet";
    if (key === "discount") {
      if (!discountOk) return "Set the discount";
      const amount =
        v.discountType === "percent"
          ? `${value}% off`
          : `${formatMoney(value ?? 0, "ZAR")} off`;
      const scope =
        v.target === "product"
          ? (chosenProduct?.name ?? "one product")
          : v.target === "type"
            ? (TYPE_LABEL[v.productType ?? ""] ?? "a product type")
            : "everything";
      return `${amount} · ${scope}`;
    }
    if (key === "limits") {
      const bits: string[] = [];
      if (v.maxRedemptions) bits.push(`${v.maxRedemptions} total`);
      if (v.perUserLimit) bits.push(`${v.perUserLimit}/user`);
      if (v.endsAt) bits.push(`ends ${v.endsAt}`);
      return bits.length ? bits.join(" · ") : "No limits";
    }
    return checklist.allDone ? "Ready to save" : "Finish the steps";
  }

  // ─── Save ─────────────────────────────────────────────────────
  function handleSave() {
    if (!codeOk) {
      setSection("details");
      toast.error("Give the code 3+ letters, numbers, - or _.");
      return;
    }
    if (!discountOk) {
      setSection("discount");
      toast.error("Check the discount and what it applies to.");
      return;
    }
    startSave(async () => {
      const r = await upsertPromo({
        id: id ?? null,
        code: v.code.trim(),
        description: v.description.trim() || null,
        discountType: v.discountType,
        discountValue: value ?? 0,
        productId: v.target === "product" ? v.productId : null,
        productType: v.target === "type" ? (v.productType as never) : null,
        currency: "ZAR",
        minSpend: numOrNull(v.minSpend),
        startsAt: v.startsAt || null,
        endsAt: v.endsAt || null,
        maxRedemptions: numOrNull(v.maxRedemptions),
        perUserLimit: numOrNull(v.perUserLimit),
        isActive: v.isActive,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      draft.clearSaved();
      setDirty(false);
      toast.success(mode === "create" ? "Promo code created." : "Saved.");
      router.push("/admin/promo-codes");
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-md border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-primary";
  const labelCls = "mb-1.5 block text-[12px] font-semibold text-brand-ink";
  const hintCls = "mt-1 text-[11px] text-brand-mute";

  return (
    <div className="space-y-5">
      {draft.hasDraft ? (
        <ResumeDraftBanner
          savedAt={draft.savedAt}
          onRestore={draft.restore}
          onDiscard={draft.discard}
        />
      ) : null}

      {/* ============ IDENTITY BAR ============ */}
      <div className="flex items-center gap-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-primary text-white">
          <Tag className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/admin/promo-codes" className="hover:text-brand-ink">
              Promo codes
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">
              {mode === "create" ? "New code" : "Editing"}
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
            href="/admin/promo-codes"
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            Cancel
          </Link>
          {/* Review owns the primary CTA — never two primary buttons. */}
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
                  ? "Create code"
                  : "Save code"}
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
                  ? "Hosts can redeem this"
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
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ============ PANEL ============ */}
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
          {section === "details" ? (
            <div className="space-y-5">
              <PanelHead
                title="Details"
                sub="The code a host types at checkout."
              />
              <div>
                <label className={labelCls} htmlFor="promo-code">
                  Code
                </label>
                <input
                  id="promo-code"
                  value={v.code}
                  onChange={(e) =>
                    patch({ code: e.target.value.toUpperCase() })
                  }
                  placeholder="WELCOME50"
                  className={`${inputCls} font-mono uppercase tracking-wide`}
                />
                <p className={hintCls}>
                  Letters, numbers, - or _. Case doesn’t matter at checkout.
                </p>
              </div>
              <div>
                <label className={labelCls} htmlFor="promo-note">
                  Internal note
                </label>
                <input
                  id="promo-note"
                  value={v.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Winter launch campaign"
                  className={inputCls}
                />
                <p className={hintCls}>
                  Only staff see this — it explains why the code exists.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-card border border-brand-line bg-brand-light/40 px-4 py-3">
                <div>
                  <div className="text-[13px] font-semibold text-brand-ink">
                    Active
                  </div>
                  <div className="text-[11px] text-brand-mute">
                    Off = nobody can redeem it, even inside its dates.
                  </div>
                </div>
                <Toggle
                  checked={v.isActive}
                  onChange={() => patch({ isActive: !v.isActive })}
                  label="Active"
                />
              </div>
            </div>
          ) : null}

          {section === "discount" ? (
            <div className="space-y-5">
              <PanelHead
                title="Discount"
                sub="How much comes off, and what it applies to."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls} htmlFor="promo-type">
                    Type
                  </label>
                  <select
                    id="promo-type"
                    value={v.discountType}
                    onChange={(e) =>
                      patch({
                        discountType: e.target.value as "percent" | "fixed",
                      })
                    }
                    className={inputCls}
                  >
                    <option value="percent">Percentage off</option>
                    <option value="fixed">Fixed amount off</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="promo-value">
                    {v.discountType === "percent" ? "Percent" : "Amount (ZAR)"}
                  </label>
                  <input
                    id="promo-value"
                    inputMode="decimal"
                    value={v.discountValue}
                    onChange={(e) => patch({ discountValue: e.target.value })}
                    className={inputCls}
                  />
                  {v.discountType === "percent" && (value ?? 0) > 100 ? (
                    <p className="mt-1 text-[11px] text-red-600">
                      A percentage can’t exceed 100%.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor="promo-target">
                  Applies to
                </label>
                <select
                  id="promo-target"
                  value={v.target}
                  onChange={(e) =>
                    patch({
                      target: e.target.value as PromoEditValues["target"],
                      productId: null,
                      productType: null,
                    })
                  }
                  className={inputCls}
                >
                  <option value="all">Every Wielo product</option>
                  <option value="product">One specific product</option>
                  <option value="type">A product type</option>
                </select>
                <p className={hintCls}>
                  A code targets one product OR one type — never both.
                </p>
              </div>

              {v.target === "product" ? (
                <div>
                  <label className={labelCls} htmlFor="promo-product">
                    Product
                  </label>
                  <select
                    id="promo-product"
                    value={v.productId ?? ""}
                    onChange={(e) =>
                      patch({ productId: e.target.value || null })
                    }
                    className={inputCls}
                  >
                    <option value="">Choose a product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatMoney(p.price, p.currency)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {v.target === "type" ? (
                <div>
                  <label className={labelCls} htmlFor="promo-ptype">
                    Product type
                  </label>
                  <select
                    id="promo-ptype"
                    value={v.productType ?? ""}
                    onChange={(e) =>
                      patch({ productType: e.target.value || null })
                    }
                    className={inputCls}
                  >
                    <option value="">Choose a type…</option>
                    {Object.entries(TYPE_LABEL).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Worked example — the same affordance the host coupon editor
                  gives, so the admin sees the real effect before saving. */}
              <Example
                discountType={v.discountType}
                value={value}
                product={chosenProduct}
              />
            </div>
          ) : null}

          {section === "limits" ? (
            <div className="space-y-5">
              <PanelHead
                title="Limits & validity"
                sub="Cap the campaign so a code can’t run forever."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Starts</label>
                  <DatePicker
                    value={v.startsAt}
                    onChange={(iso) => patch({ startsAt: iso })}
                    clearable
                    placeholder="Live immediately"
                  />
                </div>
                <div>
                  <label className={labelCls}>Ends</label>
                  <DatePicker
                    value={v.endsAt}
                    min={v.startsAt || undefined}
                    onChange={(iso) => patch({ endsAt: iso })}
                    clearable
                    placeholder="Never expires"
                  />
                  {!datesOk ? (
                    <p className="mt-1 text-[11px] text-red-600">
                      The end date is before the start date.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls} htmlFor="promo-min">
                    Min spend (ZAR)
                  </label>
                  <input
                    id="promo-min"
                    inputMode="decimal"
                    value={v.minSpend}
                    onChange={(e) => patch({ minSpend: e.target.value })}
                    placeholder="None"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="promo-max">
                    Max redemptions
                  </label>
                  <input
                    id="promo-max"
                    inputMode="numeric"
                    value={v.maxRedemptions}
                    onChange={(e) => patch({ maxRedemptions: e.target.value })}
                    placeholder="Unlimited"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="promo-per">
                    Per user
                  </label>
                  <input
                    id="promo-per"
                    inputMode="numeric"
                    value={v.perUserLimit}
                    onChange={(e) => patch({ perUserLimit: e.target.value })}
                    placeholder="Unlimited"
                    className={inputCls}
                  />
                </div>
              </div>
              <p className={hintCls}>
                Limits are checked when a code is applied at checkout. A cap can
                be overshot slightly if several buyers hold unpaid discounted
                orders at once — we never charge more than the page promised.
              </p>
            </div>
          ) : null}

          {section === "review" ? (
            <div className="space-y-5">
              <PanelHead title="Review" sub="Check it, then create the code." />
              <div className="flex items-center gap-3 rounded-card border border-brand-line bg-brand-light/40 p-4">
                <ProgressRing pct={checklist.pct} />
                <div>
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {checklist.allDone
                      ? "Ready to save"
                      : "Something’s missing"}
                  </div>
                  <div className="text-[11px] text-brand-mute">
                    {checklist.allDone
                      ? "Everything checks out."
                      : "Fix the flagged steps in the rail."}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-card border border-brand-line">
                <SummaryRow
                  label="Code"
                  value={displayCode}
                  mono
                  onEdit={() => setSection("details")}
                />
                <SummaryRow
                  label="Note"
                  value={v.description.trim() || "None"}
                  muted={!v.description.trim()}
                  onEdit={() => setSection("details")}
                />
                <SummaryRow
                  label="Discount"
                  value={
                    value == null
                      ? "Not set"
                      : v.discountType === "percent"
                        ? `${value}% off`
                        : `${formatMoney(value, "ZAR")} off`
                  }
                  muted={value == null}
                  onEdit={() => setSection("discount")}
                />
                <SummaryRow
                  label="Applies to"
                  value={
                    v.target === "product"
                      ? (chosenProduct?.name ?? "Not chosen")
                      : v.target === "type"
                        ? (TYPE_LABEL[v.productType ?? ""] ?? "Not chosen")
                        : "Every Wielo product"
                  }
                  onEdit={() => setSection("discount")}
                />
                <SummaryRow
                  label="Window"
                  value={
                    v.startsAt || v.endsAt
                      ? `${v.startsAt || "Any time"} → ${v.endsAt || "Never"}`
                      : "Always"
                  }
                  onEdit={() => setSection("limits")}
                />
                <SummaryRow
                  label="Caps"
                  value={
                    [
                      v.maxRedemptions ? `${v.maxRedemptions} total` : null,
                      v.perUserLimit ? `${v.perUserLimit} per user` : null,
                      v.minSpend
                        ? `min ${formatMoney(Number(v.minSpend), "ZAR")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No limits"
                  }
                  onEdit={() => setSection("limits")}
                />
                <SummaryRow
                  label="Status"
                  value={v.isActive ? "Active" : "Off"}
                  last
                  onEdit={() => setSection("details")}
                />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={savePending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {savePending
                  ? "Saving…"
                  : mode === "create"
                    ? "Create promo code"
                    : "Save promo code"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function PanelHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="font-display text-[17px] font-bold text-brand-ink">
        {title}
      </h2>
      <p className="mt-0.5 text-[12px] text-brand-mute">{sub}</p>
    </div>
  );
}

// What the code actually does to a real price — uses the chosen product when
// there is one, otherwise a representative R1,000 order.
function Example({
  discountType,
  value,
  product,
}: {
  discountType: "percent" | "fixed";
  value: number | null;
  product: PromoProduct | null;
}) {
  if (value == null || value <= 0) return null;
  const base = product?.price ?? 1000;
  // Same rule as resolvePlatformCoupon: whole-Rand discount, clamped after
  // rounding. Kept in step so the preview can't promise a different number
  // from the one checkout actually applies.
  const raw = discountType === "percent" ? (base * value) / 100 : value;
  const off = Math.min(Math.round(Math.max(raw, 0)), base);
  const total = round2(base - off);
  return (
    <div className="rounded-card border border-brand-line bg-brand-light/40 px-4 py-3 text-[12px]">
      <div className="font-semibold text-brand-ink">Worked example</div>
      <p className="mt-1 text-brand-mute">
        {product ? product.name : "A R1 000 order"} at{" "}
        {formatMoney(base, "ZAR")} → −{formatMoney(off, "ZAR")} ={" "}
        <span className="font-semibold text-brand-ink">
          {formatMoney(total, "ZAR")}
        </span>
        {total === 0 ? " (free)" : ""}
      </p>
    </div>
  );
}

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
