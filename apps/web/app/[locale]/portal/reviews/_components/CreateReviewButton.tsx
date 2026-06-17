"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";

// "Create review" entry point on the guest reviews page. Opens a picker of the
// guest's review-eligible stays (computed server-side using the canonical
// eligibility rule: completed + paid + not yet reviewed) and routes to the
// existing tokenised /review/[bookingId] flow on selection. The href is signed
// server-side (buildReviewPath) and passed in — never built on the client.
export type ReviewableBooking = {
  id: string;
  reviewHref: string;
  listingName: string;
  hostName: string | null;
  reference: string;
  dateLabel: string;
};

export function CreateReviewButton({
  bookings,
}: {
  bookings: ReviewableBooking[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const chosen = bookings.find((b) => b.id === selected) ?? null;

  function proceed() {
    if (!chosen) return;
    setOpen(false);
    router.push(chosen.reviewHref);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary"
      >
        <Plus className="h-4 w-4" /> Create review
      </button>

      <FormModal
        open={open}
        onOpenChange={setOpen}
        size="md"
        title="Leave a review"
        description="Pick the stay you'd like to review."
      >
        <div className="space-y-2.5">
          {bookings.length === 0 ? (
            <div className="rounded-card border border-dashed border-brand-line bg-brand-light/40 p-6 text-center text-sm text-brand-mute">
              No eligible stays yet. You can review a stay once it&apos;s
              completed.
            </div>
          ) : (
            bookings.map((b) => {
              const isSelected = b.id === selected;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b.id)}
                  aria-pressed={isSelected}
                  className={`w-full rounded-card border p-3.5 text-left transition ${
                    isSelected
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-brand-line bg-white hover:border-brand-primary/50"
                  }`}
                >
                  <div className="font-display text-sm font-semibold text-brand-ink">
                    {b.listingName}
                  </div>
                  <div className="mt-0.5 text-xs text-brand-mute">
                    {b.hostName ? `Hosted by ${b.hostName} · ` : ""}
                    {b.dateLabel}
                    {" · "}
                    <span className="font-mono">{b.reference}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <FormModalFooter>
          <FormModalCancel>Cancel</FormModalCancel>
          <button
            type="button"
            onClick={proceed}
            disabled={!chosen}
            className="inline-flex items-center gap-2 rounded-pill bg-brand-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
          >
            Continue
          </button>
        </FormModalFooter>
      </FormModal>
    </>
  );
}
