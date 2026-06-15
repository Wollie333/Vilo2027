"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
  type: "subscription" | "one_off";
  price: number;
  currency: string;
  billingCycle: "weekly" | "monthly" | "quarterly" | "biannual" | "annual";
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  affiliateType: "none" | "amount" | "percent";
  affiliateValue: number;
  bullets: string[];
  paymentMethods: ("paystack" | "eft")[];
  trialDays: number;
  isVisible: boolean;
  slug: string | null;
};

type FeatureState = { isEnabled: boolean; limitValue: number | null };

function isLimitFeature(key: string): boolean {
  return /_limit$|_seats$/.test(key);
}

export function ProductEditor({
  product,
  isNew,
  featureCatalog,
  productFeatures,
}: {
  product: EditorProduct;
  isNew: boolean;
  featureCatalog: { key: string; description: string }[];
  productFeatures: Record<string, FeatureState>;
}) {
  const router = useRouter();
  const [f, setF] = useState<EditorProduct>(product);
  const [bulletsText, setBulletsText] = useState(product.bullets.join("\n"));
  const [features, setFeatures] = useState(productFeatures);
  const [savingFeat, setSavingFeat] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  function set<K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function save() {
    if (!f.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const bullets = bulletsText
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    start(async () => {
      const r = await upsertProduct({
        id: f.id,
        name: f.name.trim(),
        description: f.description.trim() || null,
        type: f.type,
        price: f.price,
        currency: f.currency.trim().toUpperCase() || "ZAR",
        billingCycle: f.type === "subscription" ? f.billingCycle : null,
        isActive: f.isActive,
        isRecommended: f.isRecommended,
        sortOrder: f.sortOrder,
        affiliateType: f.affiliateType,
        affiliateValue: f.affiliateType === "none" ? 0 : f.affiliateValue,
        bullets,
        paymentMethods: f.paymentMethods.length
          ? f.paymentMethods
          : ["paystack"],
        trialDays: f.trialDays,
        isVisible: f.isVisible,
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

  return (
    <div className="max-w-2xl space-y-6">
      {/* Details */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          Details
        </h2>
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
            rows={4}
            className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </Field>
      </section>

      {/* Pricing + type + duration */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          Price &amp; type
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <select
              value={f.type}
              onChange={(e) =>
                set("type", e.target.value as EditorProduct["type"])
              }
              className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="subscription">Subscription</option>
              <option value="one_off">Once-off</option>
            </select>
          </Field>
          {f.type === "subscription" ? (
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
          <Field label="Price">
            <Input
              type="number"
              min={0}
              value={f.price}
              onChange={(e) => set("price", Number(e.target.value) || 0)}
              className="font-mono"
            />
          </Field>
          <Field label="Currency">
            <Input
              value={f.currency}
              maxLength={3}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              className="font-mono uppercase"
            />
          </Field>
          {f.type === "subscription" ? (
            <Field label="Trial days (0 = none)">
              <Input
                type="number"
                min={0}
                max={365}
                value={f.trialDays}
                onChange={(e) => set("trialDays", Number(e.target.value) || 0)}
                className="w-28 font-mono"
              />
            </Field>
          ) : null}
        </div>
      </section>

      {/* Payment methods */}
      <section className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          Accepted payment methods
        </h2>
        <p className="text-[12px] text-brand-mute">
          How a user can pay Vilo for this product. Configure keys/bank details
          in Payment settings.
        </p>
        <div className="flex flex-wrap gap-4">
          {(["paystack", "eft"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.paymentMethods.includes(m)}
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
              {m === "paystack" ? "Paystack (card)" : "Manual EFT"}
            </label>
          ))}
        </div>
      </section>

      {/* Affiliate */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          Affiliate payout
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Affiliate reward">
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
              label={f.affiliateType === "percent" ? "Percent (%)" : "Amount"}
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
      </section>

      {/* Flags */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sort order">
            <Input
              type="number"
              min={0}
              value={f.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
              className="w-24 font-mono"
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={f.isRecommended}
              onChange={(e) => set("isRecommended", e.target.checked)}
              className="rounded border-brand-line"
            />
            Recommended
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.isVisible}
              onChange={(e) => set("isVisible", e.target.checked)}
              className="rounded border-brand-line"
            />
            Visible on pricing page / signup
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="rounded border-brand-line"
            />
            Active (users can buy / access)
          </label>
        </div>
        <p className="text-[11px] text-brand-mute">
          Visible + active = live · Visible + inactive = shown but disabled ·
          Hidden + active = link-only · Hidden + inactive = draft.
        </p>
      </section>

      {/* Standalone page link */}
      {f.slug ? <StandaloneLinkBox slug={f.slug} /> : null}

      {/* Pay-link */}
      {f.id ? <PayLinkBox productId={f.id} /> : null}

      {/* Feature permissions */}
      <section className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          Feature permissions
        </h2>
        {!f.id ? (
          <p className="text-[13px] text-brand-mute">
            Save the product first, then assign which features it unlocks.
          </p>
        ) : (
          <div className="divide-y divide-brand-line">
            {featureCatalog.map((feat) => {
              const st = features[feat.key] ?? {
                isEnabled: false,
                limitValue: null,
              };
              const numeric = isLimitFeature(feat.key);
              return (
                <div key={feat.key} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12px] text-brand-ink">
                      {feat.key}
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      {feat.description}
                    </div>
                  </div>
                  {numeric && st.isEnabled ? (
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
                  ) : null}
                  {savingFeat === feat.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-mute" />
                  ) : null}
                  <input
                    type="checkbox"
                    checked={st.isEnabled}
                    onChange={(e) =>
                      saveFeature(feat.key, {
                        ...st,
                        isEnabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-2">
        <div>
          {!isNew ? (
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              disabled={deleting}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {deleting ? "Deleting…" : "Delete product"}
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/products")}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StandaloneLinkBox({ slug }: { slug: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/p/${slug}`;
  return (
    <section className="space-y-2 rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="font-display text-sm font-bold text-brand-ink">
        Standalone product page
      </h2>
      <p className="text-[12px] text-brand-mute">
        A public page for this product you can send to prospects. They can buy
        it there directly.
      </p>
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
    </section>
  );
}

function PayLinkBox({ productId }: { productId: string }) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="font-display text-sm font-bold text-brand-ink">
        Generate a pay-link
      </h2>
      <p className="text-[12px] text-brand-mute">
        Create a payment link for a user to buy this product, then send it to
        them. They pay Vilo via the accepted methods above.
      </p>
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
    </section>
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
