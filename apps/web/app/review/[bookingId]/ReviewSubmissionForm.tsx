"use client";

import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ACCEPTED_REVIEW_PHOTO_TYPES,
  MAX_REVIEW_PHOTOS,
  MAX_REVIEW_PHOTO_BYTES,
} from "@/lib/reviews/photos";
import { createClient } from "@/lib/supabase/client";

import { createReviewPhotoUploadUrl, submitReviewAction } from "./actions";

const MAX = 2000;

type UploadedPhoto = { path: string; previewUrl: string };

const RATING_LABELS: Record<number, string> = {
  1: "Disappointing",
  2: "Below expectations",
  3: "Good",
  4: "Great",
  5: "Outstanding",
};

// Optional per-category sub-ratings → reviews.rating_* columns.
const CATEGORIES = [
  { key: "rating_cleanliness", label: "Cleanliness" },
  { key: "rating_communication", label: "Communication" },
  { key: "rating_checkin", label: "Check-in" },
  { key: "rating_accuracy", label: "Accuracy" },
  { key: "rating_location", label: "Location" },
  { key: "rating_value", label: "Value" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

const TRIP_TYPES = [
  { key: "couples", label: "Couples" },
  { key: "family", label: "Family" },
  { key: "solo", label: "Solo" },
  { key: "friends", label: "Friends" },
  { key: "business", label: "Business" },
  { key: "other", label: "Other" },
] as const;

type TripTypeKey = (typeof TRIP_TYPES)[number]["key"];

/** Compact 1–5 star row for an optional category rating. */
function CategoryStars({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-brand-ink">{label}</span>
      <div
        className="inline-flex items-center gap-0.5"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`${label}: ${n} ${n === 1 ? "star" : "stars"}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onChange(value === n ? 0 : n)}
            className="rounded p-0.5 transition-colors hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 disabled:cursor-not-allowed"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                n <= display
                  ? "fill-amber-400 text-amber-400"
                  : "text-brand-mute/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

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
  // 0 = unset (submitted as null); each maps to a reviews.rating_* column.
  const [categories, setCategories] = useState<Record<CategoryKey, number>>({
    rating_cleanliness: 0,
    rating_communication: 0,
    rating_checkin: 0,
    rating_accuracy: 0,
    rating_location: 0,
    rating_value: 0,
  });
  const [tripType, setTripType] = useState<TripTypeKey | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const display = hover || rating;
  const remaining = MAX - body.length;
  const busy = pending || uploading;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const room = MAX_REVIEW_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_REVIEW_PHOTOS} photos.`);
      return;
    }
    const files = Array.from(fileList).slice(0, room);
    const supabase = createClient();
    setUploading(true);
    try {
      for (const file of files) {
        if (
          !ACCEPTED_REVIEW_PHOTO_TYPES.includes(
            file.type as (typeof ACCEPTED_REVIEW_PHOTO_TYPES)[number],
          )
        ) {
          toast.error(`${file.name}: use a JPEG, PNG or WebP image.`);
          continue;
        }
        if (file.size > MAX_REVIEW_PHOTO_BYTES) {
          toast.error(`${file.name}: photo must be under 8 MB.`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const ticket = await createReviewPhotoUploadUrl(bookingId, token, ext);
        if (!ticket.ok) {
          toast.error(ticket.error);
          continue;
        }
        const { error } = await supabase.storage
          .from("review-photos")
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: file.type || "image/jpeg",
          });
        if (error) {
          toast.error(`${file.name}: ${error.message || "upload failed"}`);
          continue;
        }
        setPhotos((prev) => [
          ...prev,
          { path: ticket.path, previewUrl: URL.createObjectURL(file) },
        ]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(path: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.path === path);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.path !== path);
    });
  }

  function submit() {
    if (rating < 1) {
      toast.error("Please pick a star rating.");
      return;
    }
    if (uploading) {
      toast.error("Hang on — your photos are still uploading.");
      return;
    }
    start(async () => {
      const result = await submitReviewAction(bookingId, token, {
        rating,
        body: body.trim() || null,
        rating_cleanliness: categories.rating_cleanliness || null,
        rating_communication: categories.rating_communication || null,
        rating_checkin: categories.rating_checkin || null,
        rating_accuracy: categories.rating_accuracy || null,
        rating_location: categories.rating_location || null,
        rating_value: categories.rating_value || null,
        trip_type: tripType,
        photo_paths: photos.map((p) => p.path),
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

      {/* Category sub-ratings (optional) */}
      <fieldset className="rounded border border-brand-line px-4 py-3">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
          Rate by category (optional)
        </legend>
        <div className="mt-1 space-y-2.5">
          {CATEGORIES.map((cat) => (
            <CategoryStars
              key={cat.key}
              label={cat.label}
              value={categories[cat.key]}
              disabled={pending}
              onChange={(n) =>
                setCategories((prev) => ({ ...prev, [cat.key]: n }))
              }
            />
          ))}
        </div>
      </fieldset>

      {/* Trip type (optional) */}
      <fieldset>
        <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
          Who did you travel with? (optional)
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRIP_TYPES.map((t) => {
            const active = tripType === t.key;
            return (
              <button
                key={t.key}
                type="button"
                disabled={pending}
                onClick={() => setTripType(active ? null : t.key)}
                className={`rounded-pill border px-3 py-1 text-[12px] font-semibold transition-colors ${
                  active
                    ? "border-brand-ink bg-brand-ink text-white"
                    : "border-brand-line bg-brand-light text-brand-secondary hover:bg-brand-accent"
                }`}
              >
                {t.label}
              </button>
            );
          })}
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

      {/* Photos (optional) */}
      <fieldset>
        <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
          Add photos (optional)
        </legend>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {photos.map((p) => (
            <div
              key={p.path}
              className="group relative h-20 w-20 overflow-hidden rounded-card border border-brand-line bg-brand-light"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt="Review upload preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(p.path)}
                disabled={busy}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-ink/70 text-white transition hover:bg-brand-ink"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < MAX_REVIEW_PHOTOS ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-card border border-dashed border-brand-line bg-white text-brand-mute transition hover:border-brand-primary hover:text-brand-primary disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
              <span className="text-[10px] font-semibold">
                {uploading ? "Uploading" : "Add"}
              </span>
            </button>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_REVIEW_PHOTO_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <p className="mt-1.5 text-[11px] text-brand-mute">
          Up to {MAX_REVIEW_PHOTOS} photos · JPEG, PNG or WebP · max 8 MB each.
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={busy || rating < 1}
        className="inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-secondary disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
