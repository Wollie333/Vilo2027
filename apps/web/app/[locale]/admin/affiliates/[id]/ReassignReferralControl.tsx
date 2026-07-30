"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { reassignReferralAction } from "./actions";

// Per-referral reassignment control on the admin partner page. Only offered while
// the referral is inside the 30-day correction window (SoT §3.2 rule 5); outside
// it, the RPC refuses anyway, so we simply don't show the control.
export function ReassignReferralControl({
  referralId,
  referredName,
  withinWindow,
}: {
  referralId: string;
  referredName: string;
  withinWindow: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!withinWindow) {
    return <span className="text-[11px] text-brand-mute">—</span>;
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await reassignReferralAction({
        referralId,
        newAffiliateSlug: slug.trim(),
        reason: reason.trim(),
      });
      if (res.ok) {
        setOpen(false);
        setSlug("");
        setReason("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-ghost h-8 text-[12px]"
        onClick={() => setOpen(true)}
      >
        Reassign
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-brand-line bg-[#FAFCFB] p-3 text-left">
      <div className="text-[11.5px] text-brand-mute">
        Reassign{" "}
        <span className="font-semibold text-brand-ink">{referredName}</span> to
        another partner (within 30 days).
      </div>
      <input
        className="fld h-9 text-[13px]"
        placeholder="Partner code (slug)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        disabled={pending}
      />
      <input
        className="fld h-9 text-[13px]"
        placeholder="Reason (logged)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={pending}
      />
      {error ? (
        <div className="text-[11.5px] font-medium text-[#B91C1C]">{error}</div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-pri h-8 text-[12px]"
          onClick={submit}
          disabled={pending || !slug.trim() || reason.trim().length < 3}
        >
          {pending ? "Reassigning…" : "Confirm"}
        </button>
        <button
          type="button"
          className="btn-ghost h-8 text-[12px]"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
