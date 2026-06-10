"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Responsive thumbnail grid for review photos with a tap-to-open lightbox.
 * Single source of truth for rendering review images — reused on the listing
 * page, host dashboard, admin moderation, guest portal and the submission
 * confirmation. `size` tunes the thumbnail footprint for dense vs. roomy
 * surfaces.
 */
export function ReviewPhotoGrid({
  urls,
  size = "md",
}: {
  urls: string[];
  size?: "sm" | "md";
}) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight")
        setActive((i) => (i === null ? i : (i + 1) % urls.length));
      if (e.key === "ArrowLeft")
        setActive((i) =>
          i === null ? i : (i - 1 + urls.length) % urls.length,
        );
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, urls.length]);

  if (urls.length === 0) return null;

  const thumb = size === "sm" ? "h-16 w-16" : "h-20 w-20 sm:h-24 sm:w-24";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setActive(i)}
            className={`${thumb} overflow-hidden rounded-card border border-brand-line bg-brand-light transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40`}
            aria-label={`Open review photo ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Review photo ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {active !== null ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {urls.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActive((i) =>
                  i === null ? i : (i - 1 + urls.length) % urls.length,
                );
              }}
              aria-label="Previous photo"
              className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[active]}
            alt={`Review photo ${active + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-card object-contain"
          />
          {urls.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActive((i) => (i === null ? i : (i + 1) % urls.length));
              }}
              aria-label="Next photo"
              className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
