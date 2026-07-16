"use client";

import { Flag, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

import { flagReviewAction } from "./actions";

const MAX_DETAILS = 500;

// Mirrors the `reason` enum in flagReviewAction's zod schema — keep in step.
const REASONS = [
  {
    value: "false_information",
    label: "It contains false information",
  },
  { value: "personal_attack", label: "It's a personal attack" },
  {
    value: "booking_never_occurred",
    label: "This guest never stayed with me",
  },
  { value: "other", label: "Something else" },
] as const;

/**
 * The host's side of review moderation: report a review to Wielo for a look.
 *
 * The whole downstream chain already existed — the admin queue, the host
 * "Flagged" tab, the /admin counter, even an RLS policy written to preserve the
 * host's right to flag. This dialog is the caller none of it ever had.
 */
export function FlagReviewDialog({
  open,
  onOpenChange,
  reviewId,
  guestName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewId: string;
  guestName: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const result = await flagReviewAction(reviewId, { reason, details });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Reported — we'll take a look and get back to you.");
      onOpenChange(false);
      setReason("");
      setDetails("");
      router.refresh();
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Report this review"
      description={`Ask Wielo to review ${guestName.split(" ")[0]}'s feedback. It stays visible while we look.`}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            What&apos;s wrong with it?
          </span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            className="mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
          >
            <option value="">Pick a reason…</option>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Anything that helps us judge it (optional)
          </span>
          <textarea
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
            disabled={pending}
            placeholder="Dates, booking reference, what actually happened…"
            className="mt-1 block w-full resize-none rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
          />
          <span className="mt-1 block text-[11px] text-brand-mute">
            {(MAX_DETAILS - details.length).toLocaleString("en-ZA")} characters
            left
          </span>
        </label>

        <p className="rounded-[10px] border border-brand-line bg-brand-light/40 px-3 py-2.5 text-[12.5px] text-brand-mute">
          Reporting doesn&apos;t hide the review. A person at Wielo reads it and
          decides — you can only report a review once.
        </p>
      </div>

      <FormModalFooter>
        <FormModalCancel disabled={pending} />
        <button
          type="button"
          onClick={submit}
          disabled={pending || reason === ""}
          className="inline-flex items-center gap-1.5 rounded bg-status-cancelled px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Flag className="h-4 w-4" />
          )}
          Report review
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
