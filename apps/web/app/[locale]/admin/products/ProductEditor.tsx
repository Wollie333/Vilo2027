"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Coins,
  CreditCard,
  Link2,
  Loader2,
  Pencil,
  Percent,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Trash2,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { computeCommission } from "@/lib/affiliate/commission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  deleteProduct,
  generateProductPayLink,
  upsertProduct,
  upsertProductFeature,
} from "./actions";

export type EditorProduct = {
  id: string | null;
  name: string;
  description: string;
  productType: "membership" | "service" | "product" | "wielo_credits";
  creditQuantity: number | null;
  creditPurpose: string;
  /**
   * Membership/service only: Wielo credits included each billing cycle. Stored
   * as the `wielo_credits_per_month` permission (what the grant engine reads),
   * surfaced here as a first-class field instead of a row buried in the
   * permissions list. null/0 = none from this product.
   */
  creditsPerMonth: number | null;
  price: number;
  /** Once-a-year total for the monthly/annual toggle; null = annual not offered. */
  annualPrice: number | null;
  currency: string;
  billingCycle: "weekly" | "monthly" | "quarterly" | "biannual" | "annual";
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  affiliateType: "none" | "amount" | "percent";
  affiliateValue: number;
  affiliateDuration: "once" | "months" | "forever";
  affiliateDurationMonths: number | null;
  setupFee: number;
  setupFeeLabel: string;
  setupFeeAffiliateType: "none" | "amount" | "percent";
  setupFeeAffiliateValue: number;
  bullets: string[];
  paymentMethods: ("paystack" | "paypal" | "eft")[];
  trialDays: number;
  isVisible: boolean;
  slug: string | null;
  /** Hard cap on total units ever sold (null = unlimited). */
  maxQuantity: number | null;
};

type FeatureState = { isEnabled: boolean; limitValue: number | null };

type CatalogFeature = {
  key: string;
  label: string;
  scope: "total" | "per_business" | "toggle";
  description: string;
};

type StepId =
  | "details"
  | "price"
  | "credits"
  | "payments"
  | "commission"
  | "listing"
  | "permissions"
  | "share"
  | "review"
  | "danger";

const TYPE_LABEL: Record<EditorProduct["productType"], string> = {
  membership: "Membership (Wielo plan)",
  service: "Service (subscription)",
  product: "Product (once-off)",
  wielo_credits: "Credit package (once-off)",
};

export function ProductEditor({
  product,
  isNew,
  featureCatalog,
  productFeatures,
}: {
  product: EditorProduct;
  isNew: boolean;
  featureCatalog: CatalogFeature[];
  productFeatures: Record<string, FeatureState>;
}) {
  const router = useRouter();
  const [f, setF] = useState<EditorProduct>(product);
  const [bulletsText, setBulletsText] = useState(product.bullets.join("\n"));
  const [features, setFeatures] = useState(productFeatures);
  const [savingFeat, setSavingFeat] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [step, setStep] = useState<StepId>("details");

  function set<K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  // membership | service are subscription-like (billing cycle, trial, setup fee).
  // product + wielo_credits are once-off; credits carry qty + purpose instead.
  const isSubLike =
    f.productType === "membership" || f.productType === "service";
  const isCredits = f.productType === "wielo_credits";

  const bulletList = useMemo(
    () =>
      bulletsText
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean),
    [bulletsText],
  );

  function save() {
    if (!f.name.trim()) {
      toast.error("Name is required.");
      setStep("details");
      return;
    }
    start(async () => {
      const r = await upsertProduct({
        id: f.id,
        name: f.name.trim(),
        description: f.description.trim() || null,
        productType: f.productType,
        // A credit package's on-purchase grant.
        creditQuantity:
          f.productType === "wielo_credits" ? (f.creditQuantity ?? null) : null,
        creditPurpose: f.creditPurpose || "quote",
        // A subscription's recurring allowance (saved as the
        // wielo_credits_per_month permission by the action).
        creditsPerMonth: isSubLike ? (f.creditsPerMonth ?? null) : null,
        price: f.price,
        annualPrice: isSubLike ? (f.annualPrice ?? null) : null,
        currency: f.currency.trim().toUpperCase() || "ZAR",
        billingCycle:
          f.productType === "membership" || f.productType === "service"
            ? f.billingCycle
            : null,
        isActive: f.isActive,
        isRecommended: f.isRecommended,
        sortOrder: f.sortOrder,
        affiliateType: f.affiliateType,
        affiliateValue: f.affiliateType === "none" ? 0 : f.affiliateValue,
        affiliateDuration: f.affiliateDuration,
        affiliateDurationMonths:
          f.affiliateDuration === "months"
            ? (f.affiliateDurationMonths ?? 1)
            : null,
        setupFee: f.productType !== "product" ? f.setupFee : 0,
        setupFeeLabel: f.setupFeeLabel.trim() || null,
        setupFeeAffiliateType: f.setupFeeAffiliateType,
        setupFeeAffiliateValue:
          f.setupFeeAffiliateType === "none" ? 0 : f.setupFeeAffiliateValue,
        bullets: bulletList,
        paymentMethods: f.paymentMethods.length
          ? f.paymentMethods
          : ["paystack"],
        trialDays: f.trialDays,
        isVisible: f.isVisible,
        maxQuantity: f.maxQuantity,
      });
      if (r.ok) {
        toast.success(isNew ? "Product created." : "Product saved.");
        // Land on the editor so permissions can be set on a new product.
        if (isNew && r.id) router.push(`/admin/products/${r.id}`);
        else router.push("/admin/products");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function remove() {
    if (!f.id) return;
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    startDelete(async () => {
      const r = await deleteProduct({ id: f.id! });
      if (r.ok) {
        toast.success("Product deleted.");
        router.push("/admin/products");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function saveFeature(key: string, next: FeatureState) {
    if (!f.id) return;
    const prev = features[key];
    setFeatures((s) => ({ ...s, [key]: next }));
    setSavingFeat(key);
    start(async () => {
      const r = await upsertProductFeature({
        productId: f.id!,
        featureKey: key,
        isEnabled: next.isEnabled,
        limitValue: next.limitValue,
      });
      if (!r.ok) {
        setFeatures((s) => ({
          ...s,
          [key]: prev ?? { isEnabled: false, limitValue: null },
        }));
        toast.error(r.error);
      }
      setSavingFeat((s) => (s === key ? null : s));
    });
  }

  const money = (n: number) => `${f.currency} ${n.toFixed(2)}`;

  // ── Health: the essentials a sellable product needs ─────────────────────
  const essentials = useMemo(
    () => [
      { label: "Product name", done: !!f.name.trim() },
      { label: "Details", done: !!f.description.trim() },
      { label: "At least one selling point", done: bulletList.length > 0 },
      { label: "A payment method", done: f.paymentMethods.length > 0 },
    ],
    [f.name, f.description, f.paymentMethods.length, bulletList.length],
  );
  const doneCount = essentials.filter((e) => e.done).length;
  const health = Math.round((doneCount / essentials.length) * 100);

  const enabledFeatureCount = Object.values(features).filter(
    (s) => s.isEnabled,
  ).length;

  // ── The rail. Steps adapt to the product type: a once-off product has no
  // billing cycle, credits or setup fee, so those panels don't exist for it.
  const steps: {
    id: StepId;
    label: string;
    icon: LucideIcon;
    hint: string;
    done: boolean;
  }[] = [
    {
      id: "details",
      label: "Details",
      icon: TypeIcon,
      hint: f.name.trim() || "Name and description",
      done: !!f.name.trim() && !!f.description.trim(),
    },
    {
      id: "price",
      label: "Price & type",
      icon: Tag,
      hint: `${TYPE_LABEL[f.productType].split(" (")[0]} · ${
        f.price > 0 ? money(f.price) : "Free"
      }${isSubLike ? ` / ${f.billingCycle}` : ""}`,
      done: true,
    },
    ...(isSubLike
      ? [
          {
            id: "credits" as const,
            label: "Wielo credits",
            icon: Coins,
            hint: f.creditsPerMonth
              ? `${f.creditsPerMonth} each cycle`
              : "None from this product",
            done: true,
          },
        ]
      : []),
    {
      id: "payments",
      label: "Payment methods",
      icon: CreditCard,
      hint: f.paymentMethods.length
        ? f.paymentMethods.join(" · ")
        : "None selected",
      done: f.paymentMethods.length > 0,
    },
    {
      id: "commission",
      label: isSubLike ? "Setup fee & commission" : "Commission",
      icon: Percent,
      hint:
        f.affiliateType === "none"
          ? "No affiliate commission"
          : f.affiliateType === "percent"
            ? `${f.affiliateValue}% commission`
            : `${money(f.affiliateValue)} commission`,
      done: true,
    },
    {
      id: "listing",
      label: "Listing & visibility",
      icon: SlidersHorizontal,
      hint: statusLabel(f.isVisible, f.isActive),
      done: true,
    },
    {
      id: "permissions",
      label: "Feature permissions",
      icon: ShieldCheck,
      hint: f.id ? `${enabledFeatureCount} enabled` : "Save the product first",
      done: !!f.id,
    },
    ...(f.id || f.slug
      ? [
          {
            id: "share" as const,
            label: "Share & sell",
            icon: Link2,
            hint: "Product page · pay-link",
            done: true,
          },
        ]
      : []),
    {
      id: "review",
      label: "Review",
      icon: ClipboardCheck,
      hint: `${doneCount}/${essentials.length} essentials`,
      done: doneCount === essentials.length,
    },
    ...(!isNew
      ? [
          {
            id: "danger" as const,
            label: "Danger zone",
            icon: Trash2,
            hint: "Delete this product",
            done: true,
          },
        ]
      : []),
  ];

  const idx = steps.findIndex((s) => s.id === step);
  const safeIdx = idx < 0 ? 0 : idx;
  const prevStep = steps[safeIdx - 1];
  // The bottom nav only advances up to Review — never past it, and never a
  // second create button on the last step (founder's hard rule).
  const nextStep =
    steps[safeIdx + 1]?.id === "danger" ? undefined : steps[safeIdx + 1];

  return (
    <div className="space-y-5">
      {/* ── Identity bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 rounded-card border border-brand-line bg-white p-4 shadow-card">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-brand-light text-brand-primary">
          <Tag className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Products / {isNew ? "New" : "Edit"}
          </div>
          <h1 className="truncate font-display text-lg font-bold text-brand-ink">
            {f.name.trim() || (isNew ? "New product" : "Untitled product")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill visible={f.isVisible} active={f.isActive} />
          <span className="rounded-pill bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand-ink">
            {f.price > 0 ? money(f.price) : "Free"}
            {isSubLike ? ` / ${f.billingCycle}` : ""}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[288px_1fr]">
        {/* ── Left rail ──────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-3 rounded-card border border-brand-line bg-white p-4 shadow-card">
            <div className="flex items-center gap-3 border-b border-brand-line pb-3">
              <ProgressRing value={health} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-brand-ink">
                  {doneCount === essentials.length
                    ? "Ready to sell"
                    : "Product health"}
                </div>
                <div className="text-[11.5px] text-brand-mute">
                  {doneCount}/{essentials.length} essentials done
                </div>
              </div>
            </div>
            <nav className="space-y-1">
              {steps.map((s) => {
                const Icon = s.icon;
                const on = s.id === step;
                const danger = s.id === "danger";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                      on ? "bg-brand-light" : "hover:bg-brand-light/60"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                        danger
                          ? "bg-red-50 text-red-600"
                          : on
                            ? "bg-brand-primary text-white"
                            : "bg-brand-light text-brand-mute"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[13px] font-semibold ${
                          danger ? "text-red-600" : "text-brand-ink"
                        }`}
                      >
                        {s.label}
                      </span>
                      <span className="block truncate text-[11px] text-brand-mute">
                        {s.hint}
                      </span>
                    </span>
                    {s.done && !danger ? (
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-primary text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ── Panel ─────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          {step === "details" ? (
            <Panel
              title="Details"
              hint="What this product is called and how it's sold."
            >
              <Field label="Product name">
                <Input
                  value={f.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Pro plan / White-label setup"
                />
              </Field>
              <Field label="Details">
                <textarea
                  value={f.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                />
              </Field>
              <Field label="Selling points (one per line)">
                <textarea
                  value={bulletsText}
                  onChange={(e) => setBulletsText(e.target.value)}
                  rows={5}
                  className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                />
              </Field>
            </Panel>
          ) : null}

          {step === "price" ? (
            <Panel
              title="Price & type"
              hint="What kind of product this is, and what it costs."
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Type">
                  <select
                    value={f.productType}
                    onChange={(e) =>
                      set(
                        "productType",
                        e.target.value as EditorProduct["productType"],
                      )
                    }
                    className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                  >
                    <option value="membership">Membership (Wielo plan)</option>
                    <option value="service">Service (subscription)</option>
                    <option value="product">Product (once-off)</option>
                    <option value="wielo_credits">
                      Credit package (once-off)
                    </option>
                  </select>
                </Field>
                {isSubLike ? (
                  <Field label="Duration">
                    <select
                      value={f.billingCycle}
                      onChange={(e) =>
                        set(
                          "billingCycle",
                          e.target.value as EditorProduct["billingCycle"],
                        )
                      }
                      className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="biannual">Bi-annual</option>
                      <option value="annual">Annual</option>
                    </select>
                  </Field>
                ) : null}
                <Field label={isSubLike ? "Price / month" : "Price"}>
                  <Input
                    type="number"
                    min={0}
                    value={f.price}
                    onChange={(e) => set("price", Number(e.target.value) || 0)}
                    className="font-mono"
                  />
                </Field>
                {isSubLike ? (
                  <Field label="Price / year (optional)">
                    <Input
                      type="number"
                      min={0}
                      // Empty = no annual option (monthly only). A value enables
                      // the monthly/annual toggle at checkout for this plan.
                      value={f.annualPrice ?? ""}
                      placeholder="No annual option"
                      onChange={(e) =>
                        set(
                          "annualPrice",
                          e.target.value.trim() === ""
                            ? null
                            : Number(e.target.value) || 0,
                        )
                      }
                      className="font-mono"
                    />
                  </Field>
                ) : null}
                <Field label="Currency">
                  <Input
                    value={f.currency}
                    maxLength={3}
                    onChange={(e) =>
                      set("currency", e.target.value.toUpperCase())
                    }
                    className="font-mono uppercase"
                  />
                </Field>
                {isCredits ? (
                  <>
                    <Field label="Credits granted">
                      <Input
                        type="number"
                        min={0}
                        value={f.creditQuantity ?? 0}
                        onChange={(e) =>
                          set("creditQuantity", Number(e.target.value) || 0)
                        }
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Credit purpose">
                      <select
                        value={f.creditPurpose || "quote"}
                        onChange={(e) => set("creditPurpose", e.target.value)}
                        className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                      >
                        <option value="quote">Wielo credits</option>
                        <option value="ai">AI credits</option>
                      </select>
                    </Field>
                  </>
                ) : null}
                {isSubLike ? (
                  <Field label="Trial days (0 = none)">
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={f.trialDays}
                      onChange={(e) =>
                        set("trialDays", Number(e.target.value) || 0)
                      }
                      className="font-mono"
                    />
                  </Field>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {/* The ONLY place a subscription's credit allowance is set. It saves to
              the `wielo_credits_per_month` permission, which is what the grant
              engine reads, and it works while creating the product. */}
          {step === "credits" && isSubLike ? (
            <Panel
              title="Wielo credits"
              hint="The single balance a host spends on Looking-For."
              icon={Coins}
            >
              <p className="max-w-prose text-xs text-brand-mute">
                Credits are the single balance a host spends on Looking-For:{" "}
                <strong className="font-semibold text-brand-ink">
                  1 to see
                </strong>{" "}
                a request&apos;s details and{" "}
                <strong className="font-semibold text-brand-ink">
                  1 to quote
                </strong>{" "}
                it. They never expire, and hosts can top up with a credit
                package.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Credits included each billing cycle">
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={f.creditsPerMonth ?? ""}
                    onChange={(e) =>
                      set(
                        "creditsPerMonth",
                        e.target.value === ""
                          ? null
                          : Number(e.target.value) || 0,
                      )
                    }
                    className="w-40 font-mono"
                  />
                </Field>
                <p className="max-w-prose pb-2 text-xs text-brand-mute">
                  Granted each cycle on purchase and every renewal. Leave blank
                  or 0 to give none from this product — the plan default applies
                  instead.
                </p>
              </div>
            </Panel>
          ) : null}

          {step === "payments" ? (
            <Panel
              title="Accepted payment methods"
              hint="How a user can pay Wielo for this product. Configure keys/bank details in Payment settings."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {(["paystack", "paypal", "eft"] as const).map((m) => {
                  const on = f.paymentMethods.includes(m);
                  return (
                    <label
                      key={m}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-card border p-3 text-sm transition-colors ${
                        on
                          ? "border-brand-primary bg-brand-light/50"
                          : "border-brand-line bg-white hover:bg-brand-light/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          set(
                            "paymentMethods",
                            e.target.checked
                              ? [...f.paymentMethods, m]
                              : f.paymentMethods.filter((x) => x !== m),
                          )
                        }
                        className="rounded border-brand-line"
                      />
                      <span className="font-medium text-brand-ink">
                        {m === "paystack"
                          ? "Paystack (card)"
                          : m === "paypal"
                            ? "PayPal"
                            : "Manual EFT"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {f.paymentMethods.length === 0 ? (
                <p className="text-[12px] text-red-600">
                  None selected — Paystack is used as the fallback on save.
                </p>
              ) : null}
            </Panel>
          ) : null}

          {step === "commission" ? (
            <div className="space-y-5">
              {/* Setup fee — once-off charge bundled with a subscription */}
              {isSubLike ? (
                <Panel
                  title="Setup fee (once-off)"
                  hint="A one-time charge taken with the first payment. Leave the amount at 0 for no setup fee."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Setup fee name">
                      <Input
                        value={f.setupFeeLabel}
                        onChange={(e) => set("setupFeeLabel", e.target.value)}
                        placeholder="Onboarding setup"
                      />
                    </Field>
                    <Field label="Setup fee amount">
                      <Input
                        type="number"
                        min={0}
                        value={f.setupFee}
                        onChange={(e) =>
                          set("setupFee", Number(e.target.value) || 0)
                        }
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Setup fee commission">
                      <select
                        value={f.setupFeeAffiliateType}
                        onChange={(e) =>
                          set(
                            "setupFeeAffiliateType",
                            e.target
                              .value as EditorProduct["setupFeeAffiliateType"],
                          )
                        }
                        className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                      >
                        <option value="none">None</option>
                        <option value="amount">Fixed amount</option>
                        <option value="percent">Percentage</option>
                      </select>
                    </Field>
                    {f.setupFeeAffiliateType !== "none" ? (
                      <Field
                        label={
                          f.setupFeeAffiliateType === "percent"
                            ? "Percent (%)"
                            : "Amount"
                        }
                      >
                        <Input
                          type="number"
                          min={0}
                          value={f.setupFeeAffiliateValue}
                          onChange={(e) =>
                            set(
                              "setupFeeAffiliateValue",
                              Number(e.target.value) || 0,
                            )
                          }
                          className="font-mono"
                        />
                      </Field>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-brand-mute">
                    The setup fee is charged once, so its commission is paid out
                    once.
                  </p>
                  {f.setupFeeAffiliateType !== "none" &&
                  f.setupFeeAffiliateValue > 0 &&
                  f.setupFee > 0 ? (
                    <div className="rounded-md border border-brand-accent bg-brand-light px-3 py-2 text-[12px] text-brand-ink">
                      An affiliate earns{" "}
                      <span className="font-semibold">
                        {f.currency}{" "}
                        {computeCommission(
                          f.setupFee,
                          f.setupFeeAffiliateType,
                          f.setupFeeAffiliateValue,
                        ).toFixed(2)}
                      </span>{" "}
                      once, on the {f.currency} {f.setupFee.toFixed(2)} setup
                      fee.
                    </div>
                  ) : null}
                </Panel>
              ) : null}

              {/* Referral commission — on the subscription / product price */}
              <Panel
                title={
                  f.productType !== "product"
                    ? "Subscription commission"
                    : "Referral commission"
                }
                hint="What an affiliate earns for selling this."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Commission reward">
                    <select
                      value={f.affiliateType}
                      onChange={(e) =>
                        set(
                          "affiliateType",
                          e.target.value as EditorProduct["affiliateType"],
                        )
                      }
                      className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="amount">Fixed amount</option>
                      <option value="percent">Percentage</option>
                    </select>
                  </Field>
                  {f.affiliateType !== "none" ? (
                    <Field
                      label={
                        f.affiliateType === "percent" ? "Percent (%)" : "Amount"
                      }
                    >
                      <Input
                        type="number"
                        min={0}
                        value={f.affiliateValue}
                        onChange={(e) =>
                          set("affiliateValue", Number(e.target.value) || 0)
                        }
                        className="font-mono"
                      />
                    </Field>
                  ) : null}
                </div>
                {/* Commission duration — only meaningful for recurring subscriptions */}
                {f.productType !== "product" && f.affiliateType !== "none" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Pay commission for">
                      <select
                        value={f.affiliateDuration}
                        onChange={(e) =>
                          set(
                            "affiliateDuration",
                            e.target
                              .value as EditorProduct["affiliateDuration"],
                          )
                        }
                        className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                      >
                        <option value="once">Once (first payment only)</option>
                        <option value="months">A set number of months</option>
                        <option value="forever">Forever (while active)</option>
                      </select>
                    </Field>
                    {f.affiliateDuration === "months" ? (
                      <Field label="Number of months">
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          value={f.affiliateDurationMonths ?? 1}
                          onChange={(e) =>
                            set(
                              "affiliateDurationMonths",
                              Math.max(1, Number(e.target.value) || 1),
                            )
                          }
                          className="w-28 font-mono"
                        />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
                {f.affiliateType !== "none" && f.affiliateValue > 0 ? (
                  <div className="rounded-md border border-brand-accent bg-brand-light px-3 py-2 text-[12px] text-brand-ink">
                    An affiliate earns{" "}
                    <span className="font-semibold">
                      {f.currency}{" "}
                      {computeCommission(
                        f.price,
                        f.affiliateType,
                        f.affiliateValue,
                      ).toFixed(2)}
                    </span>{" "}
                    {f.productType !== "product"
                      ? f.affiliateDuration === "once"
                        ? "on the first payment only"
                        : f.affiliateDuration === "months"
                          ? `per month for ${f.affiliateDurationMonths ?? 1} month${
                              (f.affiliateDurationMonths ?? 1) > 1 ? "s" : ""
                            }`
                          : "on every payment, for as long as they stay"
                      : "per sale"}{" "}
                    (based on the {f.currency} {f.price.toFixed(2)} price;
                    actual commission is on the net, ex-VAT amount).
                  </div>
                ) : null}
              </Panel>
            </div>
          ) : null}

          {step === "listing" ? (
            <Panel
              title="Listing & visibility"
              hint="Where this appears, and whether anyone can buy it."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sort order">
                  <Input
                    type="number"
                    min={0}
                    value={f.sortOrder}
                    onChange={(e) =>
                      set("sortOrder", Number(e.target.value) || 0)
                    }
                    className="font-mono"
                  />
                </Field>
                <Field label="Max quantity">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Unlimited"
                    value={f.maxQuantity ?? ""}
                    onChange={(e) =>
                      set(
                        "maxQuantity",
                        e.target.value.trim() === ""
                          ? null
                          : Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                    className="font-mono"
                  />
                  <p className="mt-1 text-[11px] text-brand-mute">
                    Blank = unlimited. Locks signup once this many are sold
                    (e.g. a limited beta).
                  </p>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Toggle
                  label="Recommended"
                  checked={f.isRecommended}
                  onChange={(v) => set("isRecommended", v)}
                />
                <Toggle
                  label="Visible on pricing page / signup"
                  checked={f.isVisible}
                  onChange={(v) => set("isVisible", v)}
                />
                <Toggle
                  label="Active (users can buy / access)"
                  checked={f.isActive}
                  onChange={(v) => set("isActive", v)}
                />
              </div>
              <p className="text-[11px] text-brand-mute">
                Visible + active = live · Visible + inactive = shown but
                disabled · Hidden + active = link-only · Hidden + inactive =
                draft.
              </p>
              <div className="rounded-md border border-brand-accent bg-brand-light px-3 py-2 text-[12px] text-brand-ink">
                This product is currently{" "}
                <span className="font-semibold">
                  {statusLabel(f.isVisible, f.isActive)}
                </span>
                .
              </div>
            </Panel>
          ) : null}

          {step === "permissions" ? (
            <Panel
              title="Feature permissions"
              hint="What this product unlocks. Saves as you toggle."
              icon={ShieldCheck}
            >
              {!f.id ? (
                <p className="text-[13px] text-brand-mute">
                  Save the product first, then assign which features it unlocks.
                </p>
              ) : (
                <div className="overflow-hidden rounded-card border border-brand-line bg-white">
                  <ul className="divide-y divide-brand-line">
                    {featureCatalog
                      // Wielo credits have their own step — showing the same
                      // number twice invites the two copies to disagree.
                      .filter((feat) => feat.key !== "wielo_credits_per_month")
                      .map((feat) => {
                        const st = features[feat.key] ?? {
                          isEnabled: false,
                          limitValue: null,
                        };
                        const on = st.isEnabled;
                        const hasQty = feat.scope !== "toggle";
                        return (
                          <li
                            key={feat.key}
                            className="flex items-center gap-4 px-5 py-3.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-semibold text-brand-ink">
                                  {feat.label}
                                </span>
                                {feat.scope === "per_business" ? (
                                  <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-brand-mute">
                                    per business
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] text-brand-mute">
                                {feat.key}
                              </div>
                            </div>
                            {/* Quantity for capacity + per-business features (blank = unlimited). */}
                            {on && hasQty ? (
                              <label className="flex items-center gap-1.5 text-[10.5px] text-brand-mute">
                                {feat.scope === "per_business"
                                  ? "Per biz"
                                  : "Qty"}
                                <input
                                  type="number"
                                  min={0}
                                  value={st.limitValue ?? ""}
                                  placeholder="∞"
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    setFeatures((s) => ({
                                      ...s,
                                      [feat.key]: {
                                        ...st,
                                        limitValue: v === "" ? null : Number(v),
                                      },
                                    }));
                                  }}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    saveFeature(feat.key, {
                                      ...st,
                                      limitValue: v === "" ? null : Number(v),
                                    });
                                  }}
                                  className="w-16 rounded-md border border-brand-line px-2 py-1 text-center font-mono text-[12px] focus:border-brand-primary focus:outline-none"
                                />
                              </label>
                            ) : null}
                            {savingFeat === feat.key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-mute" />
                            ) : null}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={on}
                              aria-label={feat.label}
                              onClick={() =>
                                saveFeature(feat.key, { ...st, isEnabled: !on })
                              }
                              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                                on ? "bg-brand-primary" : "bg-brand-line"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                  on ? "left-[22px]" : "left-0.5"
                                }`}
                              />
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </Panel>
          ) : null}

          {step === "share" ? (
            <div className="space-y-5">
              {f.slug ? <StandaloneLinkBox slug={f.slug} /> : null}
              {f.id ? <PayLinkBox productId={f.id} /> : null}
            </div>
          ) : null}

          {step === "review" ? (
            <Panel
              title="Review"
              hint="Everything about this product, at a glance."
              icon={ClipboardCheck}
            >
              <div className="flex items-center gap-3 rounded-card border border-brand-line bg-brand-light/40 p-3">
                <ProgressRing value={health} />
                <div>
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {doneCount === essentials.length
                      ? "Ready to sell"
                      : `${essentials.length - doneCount} thing${
                          essentials.length - doneCount > 1 ? "s" : ""
                        } still missing`}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {essentials.map((e) => (
                      <li
                        key={e.label}
                        className={`text-[11.5px] ${
                          e.done
                            ? "text-brand-mute"
                            : "font-semibold text-red-600"
                        }`}
                      >
                        {e.done ? "✓" : "○"} {e.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <dl className="divide-y divide-brand-line rounded-card border border-brand-line">
                <ReviewRow
                  label="Name"
                  value={f.name.trim() || "—"}
                  onEdit={() => setStep("details")}
                />
                <ReviewRow
                  label="Type"
                  value={TYPE_LABEL[f.productType]}
                  onEdit={() => setStep("price")}
                />
                <ReviewRow
                  label="Price"
                  value={`${f.price > 0 ? money(f.price) : "Free"}${
                    isSubLike ? ` / ${f.billingCycle}` : ""
                  }${isSubLike && f.trialDays > 0 ? ` · ${f.trialDays}-day trial` : ""}`}
                  onEdit={() => setStep("price")}
                />
                {isSubLike ? (
                  <ReviewRow
                    label="Wielo credits"
                    value={
                      f.creditsPerMonth
                        ? `${f.creditsPerMonth} each cycle`
                        : "None — plan default applies"
                    }
                    onEdit={() => setStep("credits")}
                  />
                ) : null}
                {isCredits ? (
                  <ReviewRow
                    label="Credits granted"
                    value={`${f.creditQuantity ?? 0} · ${
                      f.creditPurpose === "ai" ? "AI credits" : "Wielo credits"
                    }`}
                    onEdit={() => setStep("price")}
                  />
                ) : null}
                <ReviewRow
                  label="Payment methods"
                  value={
                    f.paymentMethods.length
                      ? f.paymentMethods.join(" · ")
                      : "None (Paystack fallback)"
                  }
                  onEdit={() => setStep("payments")}
                />
                {isSubLike && f.setupFee > 0 ? (
                  <ReviewRow
                    label="Setup fee"
                    value={`${money(f.setupFee)}${f.setupFeeLabel.trim() ? ` · ${f.setupFeeLabel.trim()}` : ""}`}
                    onEdit={() => setStep("commission")}
                  />
                ) : null}
                <ReviewRow
                  label="Commission"
                  value={
                    f.affiliateType === "none"
                      ? "None"
                      : `${
                          f.affiliateType === "percent"
                            ? `${f.affiliateValue}%`
                            : money(f.affiliateValue)
                        } · ${
                          f.productType === "product"
                            ? "per sale"
                            : f.affiliateDuration === "once"
                              ? "first payment only"
                              : f.affiliateDuration === "months"
                                ? `${f.affiliateDurationMonths ?? 1} months`
                                : "forever"
                        }`
                  }
                  onEdit={() => setStep("commission")}
                />
                <ReviewRow
                  label="Status"
                  value={`${statusLabel(f.isVisible, f.isActive)}${
                    f.maxQuantity != null ? ` · max ${f.maxQuantity}` : ""
                  }${f.isRecommended ? " · recommended" : ""}`}
                  onEdit={() => setStep("listing")}
                />
                {f.id ? (
                  <ReviewRow
                    label="Feature permissions"
                    value={`${enabledFeatureCount} enabled`}
                    onEdit={() => setStep("permissions")}
                  />
                ) : null}
              </dl>

              {/* The single primary CTA — the bottom nav never renders a second
                  create button on this step (founder's hard rule). */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/admin/products")}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={save} disabled={pending}>
                  {pending
                    ? "Saving…"
                    : isNew
                      ? "Create product"
                      : "Save changes"}
                </Button>
              </div>
            </Panel>
          ) : null}

          {step === "danger" && !isNew ? (
            <Panel
              title="Danger zone"
              hint="Deleting a product is permanent."
              icon={Trash2}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-red-200 bg-red-50/50 p-4">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    Delete &ldquo;{f.name.trim() || "this product"}&rdquo;
                  </div>
                  <p className="text-[12px] text-brand-mute">
                    Removes it from the catalog. Existing subscriptions and
                    orders are not affected.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={remove}
                  disabled={deleting}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  {deleting ? "Deleting…" : "Delete product"}
                </Button>
              </div>
            </Panel>
          ) : null}

          {/* ── Wizard nav: advances up to Review only ─────────────────── */}
          {step !== "review" && step !== "danger" ? (
            <div className="flex items-center justify-between gap-2">
              {prevStep && prevStep.id !== "danger" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(prevStep.id)}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  {prevStep.label}
                </Button>
              ) : (
                <span />
              )}
              {nextStep ? (
                <Button type="button" onClick={() => setStep(nextStep.id)}>
                  {nextStep.label}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Visible + active = live · Visible + inactive = shown but disabled · Hidden + active = link-only · Hidden + inactive = draft. */
function statusLabel(visible: boolean, active: boolean): string {
  if (visible && active) return "Live";
  if (visible && !active) return "Shown but disabled";
  if (!visible && active) return "Link-only";
  return "Draft";
}

function StatusPill({
  visible,
  active,
}: {
  visible: boolean;
  active: boolean;
}) {
  const label = statusLabel(visible, active);
  const live = visible && active;
  return (
    <span
      className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
        live
          ? "bg-brand-primary/10 text-brand-primary"
          : "bg-brand-light text-brand-mute"
      }`}
    >
      {label}
    </span>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-brand-line"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="stroke-brand-primary transition-all"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-brand-ink">
        {value}%
      </span>
    </div>
  );
}

function Panel({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        ) : null}
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-brand-ink">
            {title}
          </h2>
          {hint ? (
            <p className="mt-0.5 max-w-prose text-[12px] text-brand-mute">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <dt className="w-44 shrink-0 text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate text-[13px] text-brand-ink">
        {value}
      </dd>
      <button
        type="button"
        onClick={onEdit}
        className="flex shrink-0 items-center gap-1 rounded border border-brand-line px-2 py-1 text-[11px] font-medium text-brand-ink hover:bg-brand-light"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-card border p-3 text-sm transition-colors ${
        checked
          ? "border-brand-primary bg-brand-light/50"
          : "border-brand-line bg-white hover:bg-brand-light/30"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-brand-line"
      />
      <span className="font-medium text-brand-ink">{label}</span>
    </label>
  );
}

function StandaloneLinkBox({ slug }: { slug: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/p/${slug}`;
  return (
    <Panel
      title="Standalone product page"
      hint="A public page for this product you can send to prospects. They can buy it there directly."
      icon={Link2}
    >
      <div className="flex items-center gap-2 rounded-md border border-brand-line bg-brand-light/40 px-3 py-2">
        <input
          readOnly
          value={url}
          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-brand-ink outline-none"
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            toast.success("Copied.");
          }}
          className="rounded border border-brand-line bg-white px-3 py-1 text-xs font-medium text-brand-ink hover:bg-brand-light"
        >
          Copy
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-brand-line bg-white px-3 py-1 text-xs font-medium text-brand-ink hover:bg-brand-light"
        >
          Open
        </a>
      </div>
    </Panel>
  );
}

function PayLinkBox({ productId }: { productId: string }) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Panel
      title="Generate a pay-link"
      hint="Create a payment link for a user to buy this product, then send it to them. They pay Wielo via the accepted methods above."
      icon={CreditCard}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="block flex-1 space-y-1.5">
          <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
            User email
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </label>
        <Button
          type="button"
          disabled={pending || !email.trim()}
          onClick={() =>
            start(async () => {
              const r = await generateProductPayLink({
                productId,
                email: email.trim(),
              });
              if (r.ok) {
                setUrl(r.url);
                toast.success("Pay-link created.");
              } else {
                toast.error(r.error);
              }
            })
          }
        >
          {pending ? "Creating…" : "Create link"}
        </Button>
      </div>
      {url ? (
        <div className="flex items-center gap-2 rounded-md border border-brand-line bg-brand-light/40 px-3 py-2">
          <input
            readOnly
            value={url}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-brand-ink outline-none"
          />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              toast.success("Copied.");
            }}
            className="rounded border border-brand-line bg-white px-3 py-1 text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            Copy
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
