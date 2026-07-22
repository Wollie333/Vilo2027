"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";

import { setCampaignEnrollmentStatusAction } from "../actions";

// Pause / resume one partner in one competition.
//
// This is NOT the global suspend on the affiliates panel — pausing only takes
// the partner out of the race. The copy below says so explicitly, because the
// two are easy to confuse and picking the wrong one costs a partner real money.

export function EnrollmentPauseButton({
  campaignId,
  affiliateId,
  name,
  status,
}: {
  campaignId: string;
  affiliateId: string;
  name: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  // Withdrawn / removed are terminal — nothing to pause or resume.
  if (status !== "active" && status !== "paused") return null;

  const isPaused = status === "paused";

  function submit(next: "active" | "paused") {
    startTransition(async () => {
      const res = await setCampaignEnrollmentStatusAction({
        campaignId,
        affiliateId,
        status: next,
        reason:
          next === "paused"
            ? reason.trim()
            : "Resumed from the campaign admin page.",
      });
      if (res.ok) {
        toast.success(
          next === "paused"
            ? `${name} paused — they've been emailed.`
            : `${name} is back in the race — they've been emailed.`,
        );
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (isPaused ? submit("active") : setOpen(true))}
        className="inline-flex h-8 items-center rounded-md border border-brand-line px-3 text-[12px] font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-50"
      >
        {isPaused ? "Resume" : "Pause"}
      </button>

      <Modal
        open={open}
        onOpenChange={(o) => {
          if (!o) setReason("");
          setOpen(o);
        }}
        intent="warning"
        title={`Pause ${name} in this competition?`}
        description="They drop off the leaderboard and out of prize contention. Their referral links keep working, their commission ladder is untouched, and their score keeps counting — so resuming picks up where they actually are."
        input={
          <div className="text-left">
            <label
              htmlFor="pause-reason"
              className="mb-1 block text-[12px] font-medium text-brand-ink"
            >
              Reason — shown to the partner
            </label>
            <textarea
              id="pause-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Under review following a referral-quality query."
              className="input w-full"
            />
          </div>
        }
        actions={[
          { label: "Cancel", kind: "ghost", onClick: () => setOpen(false) },
          {
            label: "Pause partner",
            kind: "danger",
            disabled: reason.trim().length < 3 || pending,
            onClick: () => {
              submit("paused");
              // Keep the modal open until the action settles and closes it.
              return false;
            },
          },
        ]}
      />
    </>
  );
}
