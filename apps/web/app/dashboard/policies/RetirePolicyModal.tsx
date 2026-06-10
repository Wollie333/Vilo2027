"use client";

import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import {
  getPolicyRetirementInfoAction,
  retirePolicyAction,
  type PolicyRetirementInfo,
} from "./actions";

/**
 * Impact-aware "remove policy" flow. Shows where the policy is used and how many
 * live bookings reference it, lets the host pick a replacement for the listings
 * it covers, then archives it. Existing bookings keep their snapshot, so refunds
 * are never affected — the modal says so explicitly.
 */
export function RetirePolicyModal({
  open,
  onOpenChange,
  policyId,
  policyName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
  policyName: string;
  onDone: () => void;
}) {
  const [info, setInfo] = useState<PolicyRetirementInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [replacement, setReplacement] = useState<string>("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) {
      setInfo(null);
      setReplacement("");
      return;
    }
    setLoading(true);
    getPolicyRetirementInfoAction(policyId)
      .then((r) => {
        if (r.ok) setInfo(r.data ?? null);
        else toast.error(r.error);
      })
      .finally(() => setLoading(false));
  }, [open, policyId]);

  const assignedCount = info?.assignments.length ?? 0;
  const needsReplacement = assignedCount > 0;

  function confirm() {
    start(async () => {
      const r = await retirePolicyAction(
        policyId,
        replacement === "" ? null : replacement,
      );
      if (r.ok) {
        toast.success("Policy removed");
        onOpenChange(false);
        onDone();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Remove “${policyName}”?`}
      description="It's archived, not deleted — existing bookings keep the terms they were booked under."
    >
      {loading || !info ? (
        <div className="flex items-center justify-center py-8 text-brand-mute">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Impact */}
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Assigned to"
              value={`${assignedCount}`}
              unit={assignedCount === 1 ? "place" : "places"}
            />
            <Stat
              label="Live bookings"
              value={`${info.activeBookings}`}
              unit={info.activeBookings === 1 ? "booking" : "bookings"}
            />
          </div>

          {assignedCount > 0 ? (
            <ul className="max-h-28 overflow-y-auto rounded-[10px] border border-brand-line bg-brand-light/40 px-3 py-2 text-[12.5px] text-brand-mute">
              {info.assignments.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 py-0.5"
                >
                  <span className="truncate text-brand-ink">
                    {a.listingName}
                  </span>
                  <span className="shrink-0">
                    {a.roomScoped ? "room override" : "listing-wide"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Booking safety note */}
          <div className="flex items-start gap-2 rounded-[10px] border border-brand-primary/20 bg-brand-accent/30 px-3 py-2.5 text-[12.5px] text-brand-ink">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <span>
              {info.activeBookings > 0
                ? `${info.activeBookings} live ${info.activeBookings === 1 ? "booking keeps" : "bookings keep"} the exact terms they were booked under — refunds are unaffected.`
                : "No live bookings use this policy. Existing bookings always keep their own snapshot."}
            </span>
          </div>

          {/* Replacement */}
          {needsReplacement ? (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Reassign those {assignedCount === 1 ? "place" : "places"} to
              </span>
              <select
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
              >
                <option value="">My default policy (recommended)</option>
                {info.replacements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.isDefault ? " · default" : ""}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-brand-mute">
                Leaving it on “My default policy” lets each listing fall back to
                your default for this type.
              </span>
            </label>
          ) : null}
        </div>
      )}

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || loading || !info}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-status-cancelled px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {pending ? "Removing…" : "Remove policy"}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-[10px] border border-brand-line bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="mt-0.5 font-display text-xl font-bold text-brand-ink">
        {value}{" "}
        <span className="text-xs font-medium text-brand-mute">{unit}</span>
      </div>
    </div>
  );
}
