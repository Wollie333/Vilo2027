"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  updateAffiliateSettingsAction,
  updatePayoutFeeAction,
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

const METHOD_LABEL: Record<string, string> = {
  eft: "EFT",
  paystack: "Paystack",
  paypal: "PayPal",
};

export function AffiliateSettingsClient({
  settings,
  fees,
}: {
  settings: Settings;
  fees: Fee[];
}) {
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState(settings);
  const [feeState, setFeeState] = useState(fees);

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

  return (
    <div className="space-y-6">
      {/* Programme settings */}
      <section className="am-card p-6">
        <div className="smallcaps">Tracking &amp; payouts</div>
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
            <span className="flabel">Terms version</span>
            <input
              value={s.termsVersion}
              onChange={(e) => setS({ ...s, termsVersion: e.target.value })}
              className="fld"
            />
          </label>
          <label className="block">
            <span className="flabel">Attribution</span>
            <select
              value={s.attributionModel}
              onChange={(e) =>
                setS({
                  ...s,
                  attributionModel: e.target
                    .value as Settings["attributionModel"],
                })
              }
              className="fld"
            >
              <option value="last_click">Last click wins</option>
              <option value="first_click">First click wins</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={saveSettings}
            disabled={pending}
            className="btn-pri h-9"
          >
            Save settings
          </button>
        </div>
      </section>

      {/* Payout fees */}
      <section className="am-card p-6">
        <div className="smallcaps">Payout processor fees</div>
        <p className="mt-1 text-[12px] text-brand-mute">
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
              <button
                type="button"
                disabled={pending}
                onClick={() => saveFee(feeState[i])}
                className="btn-sec h-[42px]"
              >
                Save
              </button>
            </div>
          ))}
        </div>
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
      <span className="flabel">{label}</span>
      <input
        type="number"
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="fld"
      />
    </label>
  );
}
