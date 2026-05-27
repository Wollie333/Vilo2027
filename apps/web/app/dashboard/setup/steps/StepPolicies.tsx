"use client";

import { Check, Clock, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveListingPatchAction } from "../../listings/[id]/edit/actions";
import type { Listing } from "../types";

type PolicyKind = "flexible" | "moderate" | "strict";

const POLICY_OPTIONS: {
  value: PolicyKind;
  title: string;
  blurb: string;
  details: string;
}[] = [
  {
    value: "flexible",
    title: "Flexible",
    blurb: "Most forgiving — guests can change plans freely.",
    details: "Full refund up to 24 hours before check-in.",
  },
  {
    value: "moderate",
    title: "Moderate",
    blurb: "Balanced — recommended for most hosts.",
    details: "Full refund up to 5 days before check-in, 50% within 5 days.",
  },
  {
    value: "strict",
    title: "Strict",
    blurb: "For high-demand or peak-season properties.",
    details:
      "50% refund up to 7 days before check-in. No refund within 7 days.",
  },
];

type Props = {
  listing: Listing;
  onSaved: (patch: Partial<Listing>) => void;
};

export function StepPolicies({ listing, onSaved }: Props) {
  const [policy, setPolicy] = useState<PolicyKind>(
    listing.cancellation_policy ?? "moderate",
  );
  const [checkIn, setCheckIn] = useState(listing.check_in_time || "15:00");
  const [checkOut, setCheckOut] = useState(listing.check_out_time || "10:00");
  const [houseRules, setHouseRules] = useState(listing.house_rules);
  const [pending, startSave] = useTransition();

  const isExperience = listing.listing_type === "experience";

  function onSave() {
    startSave(async () => {
      const patch: Parameters<typeof saveListingPatchAction>[1] = {
        cancellation_policy: policy,
        house_rules: houseRules.trim() ? houseRules.trim() : null,
      };
      if (!isExperience) {
        patch.check_in_time = checkIn || null;
        patch.check_out_time = checkOut || null;
      }
      const result = await saveListingPatchAction(listing.id, patch);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved({
        cancellation_policy: policy,
        check_in_time: checkIn,
        check_out_time: checkOut,
        house_rules: houseRules.trim(),
      });
      toast.success("Policies saved.");
    });
  }

  return (
    <div className="space-y-8">
      {/* Cancellation policy */}
      <section>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Cancellation policy
            </h3>
            <p className="text-xs text-brand-mute">
              Pick one. You can offer different policies per listing later from
              the editor.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {POLICY_OPTIONS.map((opt) => {
            const selected = policy === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPolicy(opt.value)}
                className={`flex flex-col items-start gap-1.5 rounded-card border-2 p-4 text-left transition ${
                  selected
                    ? "border-brand-primary bg-brand-accent/40 shadow-card"
                    : "border-brand-line bg-white hover:border-brand-primary/40 hover:bg-brand-light/60"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="font-display text-sm font-semibold text-brand-ink">
                    {opt.title}
                  </div>
                  {selected ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-brand-primary text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-pill border border-brand-line" />
                  )}
                </div>
                <div className="text-[12px] font-medium text-brand-ink">
                  {opt.blurb}
                </div>
                <div className="text-[11px] leading-relaxed text-brand-mute">
                  {opt.details}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Check-in / check-out times — accommodation only */}
      {!isExperience ? (
        <section>
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-brand-ink">
                Check-in &amp; check-out
              </h3>
              <p className="text-xs text-brand-mute">
                Default times for every booking. Guests can request flexible
                times in their booking notes.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Check-in from">
              <input
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
            </Field>
            <Field label="Check-out by">
              <input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
              />
            </Field>
          </div>
        </section>
      ) : null}

      {/* House rules */}
      <section>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              House rules{" "}
              <span className="text-xs font-medium text-brand-mute">
                (optional)
              </span>
            </h3>
            <p className="text-xs text-brand-mute">
              Tell guests what you expect. Pets, smoking, parties, noise hours —
              anything that matters.
            </p>
          </div>
        </div>

        <textarea
          value={houseRules}
          onChange={(e) => setHouseRules(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="No parties or events. Quiet hours 22:00 – 06:00. Small dogs welcome with prior notice. Strictly no smoking indoors…"
          className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
        />
        <div className="mt-1 text-right text-[10.5px] text-brand-mute">
          {houseRules.length}/2000
        </div>
      </section>

      {/* Save & continue */}
      <div className="flex justify-end border-t border-brand-line pt-5">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save & continue"}
        </button>
      </div>
    </div>
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
    <label className="block">
      <div className="mb-1 font-display text-[12.5px] font-semibold text-brand-ink">
        {label}
      </div>
      {children}
    </label>
  );
}
