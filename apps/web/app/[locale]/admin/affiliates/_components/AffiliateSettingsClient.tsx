"use client";

import { Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  deleteMarketingAssetAction,
  updateAffiliateSettingsAction,
  updatePayoutFeeAction,
  uploadMarketingAssetAction,
} from "../actions";

type Settings = {
  cookieDays: number;
  holdDays: number;
  minPayoutThreshold: number;
  termsVersion: string;
  attributionModel: "first_click" | "last_click";
  currency: string;
};
type Fee = {
  method: "eft" | "paystack" | "paypal";
  fixedFee: number;
  percentFee: number;
  capFee: number | null;
};
type Asset = {
  id: string;
  title: string;
  category: string;
  fileUrl: string | null;
  mimeType: string | null;
  isActive: boolean;
};

const METHOD_LABEL: Record<string, string> = {
  eft: "EFT",
  paystack: "Paystack",
  paypal: "PayPal",
};

export function AffiliateSettingsClient({
  settings,
  fees,
  assets,
}: {
  settings: Settings;
  fees: Fee[];
  assets: Asset[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState(settings);
  const [feeState, setFeeState] = useState(fees);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveSettings() {
    startTransition(async () => {
      const res = await updateAffiliateSettingsAction({
        cookieDays: Number(s.cookieDays),
        holdDays: Number(s.holdDays),
        minPayoutThreshold: Number(s.minPayoutThreshold),
        termsVersion: s.termsVersion,
        attributionModel: s.attributionModel,
      });
      if (res.ok) toast.success("Settings saved.");
      else toast.error(res.error);
    });
  }

  function saveFee(f: Fee) {
    startTransition(async () => {
      const res = await updatePayoutFeeAction({
        method: f.method,
        fixedFee: Number(f.fixedFee),
        percentFee: Number(f.percentFee),
        capFee: f.capFee != null ? Number(f.capFee) : null,
      });
      if (res.ok) toast.success(`${METHOD_LABEL[f.method]} fee saved.`);
      else toast.error(res.error);
    });
  }

  function upload(formEl: HTMLFormElement) {
    const fd = new FormData(formEl);
    startTransition(async () => {
      const res = await uploadMarketingAssetAction(fd);
      if (res.ok) {
        toast.success("Asset uploaded.");
        formEl.reset();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Programme settings */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h2 className="font-display text-base font-semibold text-brand-ink">
          Tracking & payouts
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Cookie window (days)"
            value={s.cookieDays}
            onChange={(v) => setS({ ...s, cookieDays: v })}
          />
          <NumberField
            label="Refund hold (days)"
            value={s.holdDays}
            onChange={(v) => setS({ ...s, holdDays: v })}
          />
          <NumberField
            label={`Min payout (${s.currency})`}
            value={s.minPayoutThreshold}
            onChange={(v) => setS({ ...s, minPayoutThreshold: v })}
          />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
              Terms version
            </span>
            <input
              value={s.termsVersion}
              onChange={(e) => setS({ ...s, termsVersion: e.target.value })}
              className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
              Attribution
            </span>
            <select
              value={s.attributionModel}
              onChange={(e) =>
                setS({
                  ...s,
                  attributionModel: e.target
                    .value as Settings["attributionModel"],
                })
              }
              className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            >
              <option value="last_click">Last click wins</option>
              <option value="first_click">First click wins</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveSettings} disabled={pending}>
            Save settings
          </Button>
        </div>
      </section>

      {/* Payout fees */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h2 className="font-display text-base font-semibold text-brand-ink">
          Payout processor fees
        </h2>
        <p className="mt-0.5 text-xs text-brand-mute">
          Deducted from each affiliate payout. fee = min(cap, fixed + gross ×
          percent%).
        </p>
        <div className="mt-4 space-y-3">
          {feeState.map((f, i) => (
            <div
              key={f.method}
              className="grid items-end gap-3 sm:grid-cols-[100px_1fr_1fr_1fr_auto]"
            >
              <div className="text-sm font-semibold text-brand-ink">
                {METHOD_LABEL[f.method]}
              </div>
              <NumberField
                label="Fixed"
                value={f.fixedFee}
                onChange={(v) =>
                  setFeeState(
                    feeState.map((x, j) =>
                      j === i ? { ...x, fixedFee: v } : x,
                    ),
                  )
                }
              />
              <NumberField
                label="Percent %"
                value={f.percentFee}
                step="0.1"
                onChange={(v) =>
                  setFeeState(
                    feeState.map((x, j) =>
                      j === i ? { ...x, percentFee: v } : x,
                    ),
                  )
                }
              />
              <NumberField
                label="Cap (0 = none)"
                value={f.capFee ?? 0}
                onChange={(v) =>
                  setFeeState(
                    feeState.map((x, j) => (j === i ? { ...x, capFee: v } : x)),
                  )
                }
              />
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => saveFee(feeState[i])}
              >
                Save
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Marketing assets */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h2 className="font-display text-base font-semibold text-brand-ink">
          Marketing material
        </h2>
        <p className="mt-0.5 text-xs text-brand-mute">
          Banners and images affiliates download or embed. Max 10MB each.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            upload(e.currentTarget);
          }}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
              Title
            </span>
            <input
              name="title"
              required
              className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
              Category
            </span>
            <select
              name="category"
              className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
            >
              <option value="banner">Banner</option>
              <option value="social">Social</option>
              <option value="email">Email</option>
              <option value="logo">Logo</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
              File
            </span>
            <input
              ref={fileRef}
              name="file"
              type="file"
              required
              accept="image/*"
              className="mt-1 w-full rounded-md border border-brand-line px-3 py-1.5 text-sm"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={pending} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </form>

        {assets.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assets.map((a) => (
              <li
                key={a.id}
                className="overflow-hidden rounded-card border border-brand-line"
              >
                <div className="flex aspect-[16/9] items-center justify-center bg-brand-light">
                  {(a.mimeType ?? "").startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.fileUrl ?? undefined}
                      alt={a.title}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-brand-mute">
                      {a.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-brand-ink">
                      {a.title}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-brand-mute">
                      {a.category}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deleteMarketingAssetAction(a.id);
                        if (res.ok) {
                          toast.success("Asset removed.");
                          router.refresh();
                        } else toast.error(res.error);
                      })
                    }
                    disabled={pending}
                    className="rounded-md p-1.5 text-brand-mute hover:bg-brand-light hover:text-status-cancelled"
                    aria-label="Delete asset"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-brand-mute">
            No marketing material uploaded yet.
          </p>
        )}
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      <input
        type="number"
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-brand-line px-3 py-2 text-sm"
      />
    </label>
  );
}
