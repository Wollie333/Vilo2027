"use client";

import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitReviewAction } from "./actions";

const MAX = 2000;

const RATING_LABELS: Record<number, string> = {
  1: "Disappointing",
  2: "Below expectations",
  3: "Good",
  4: "Great",
  5: "Outstanding",
};

export function ReviewSubmissionForm({
  bookingId,
  token,
}: {
  bookingId: string;
  token: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const display = hover || rating;
  const remaining = MAX - body.length;

  function submit() {
    if (rating < 1) {
      toast.error("Please pick a star rating.");
      return;
    }
    start(async () => {
      const result = await submitReviewAction(bookingId, token, {
        rating,
        body: body.trim() || null,
      });
      if (result.ok) {
        toast.success("Thanks — your review has been submitted.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      {/* Rating */}
      <fieldset className="text-center">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
          Overall rating
        </legend>
        <div
          className="mt-3 inline-flex items-center gap-1"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onClick={() => setRating(n)}
              className="rounded p-1 transition-colors hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            >
              <Star
                className={`h-9 w-9 transition-colors ${
                  n <= display
                    ? "fill-amber-400 text-amber-400"
                    : "text-brand-mute/40"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 h-5 text-[13px] font-medium text-brand-ink">
          {display > 0 ? RATING_LABELS[display] : "Tap a star to rate"}
        </div>
      </fieldset>

      {/* Body */}
      <div>
        <label
          htmlFor="review-body"
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute"
        >
          Your review (optional)
        </label>
        <textarea
          id="review-body"
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX))}
          placeholder="What did you love? What could the host improve? Helpful, specific details mean more to future guests than five-word summaries."
          disabled={pending}
          className="mt-1.5 block w-full rounded border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink shadow-sm placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
        <div className="mt-1.5 text-right text-[11px] text-brand-mute">
          {remaining.toLocaleString()} characters left
        </div>
      </div>

      <button
        type="submit"
        disabled={pending || rating < 1}
        className="inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-secondary disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
