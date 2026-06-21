"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { GalleryImage } from "@/lib/site/types";

import { siteImageStyle } from "./sections/_shared";
import { SiteImg } from "./SiteImg";

/**
 * Gallery grid + swipeable fullscreen lightbox (Phase 7c). The grid mirrors the
 * three section layouts (grid / list / carousel); clicking any tile opens a
 * themed overlay with prev/next, keyboard arrows, touch-swipe, a counter and a
 * caption. Thumbnails and the full image both ride the Supabase transform
 * pipeline via <SiteImg>, so each is sized to its slot.
 */
export function GalleryLightbox({
  images,
  layout,
}: {
  images: GalleryImage[];
  layout?: "grid" | "list" | "carousel";
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;
  const count = images.length;

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (dir: number) =>
      setOpenIndex((i) => (i === null ? i : (i + dir + count) % count)),
    [count],
  );

  // Keyboard nav + scroll-lock while the overlay is open.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close, step]);

  // Touch-swipe: a horizontal drag over ~40px steps the slide.
  const [touchX, setTouchX] = useState<number | null>(null);
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    setTouchX(null);
  }

  const cols =
    layout === "list"
      ? "grid-cols-1"
      : layout === "carousel"
        ? "grid-flow-col auto-cols-[80%] sm:auto-cols-[45%] overflow-x-auto"
        : "grid-cols-2 md:grid-cols-3";
  const thumbSizes =
    layout === "list"
      ? "100vw"
      : layout === "carousel"
        ? "(min-width: 640px) 45vw, 80vw"
        : "(min-width: 768px) 33vw, 50vw";

  const active = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      <div className={`grid gap-3 ${cols}`}>
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={img.caption || `View image ${i + 1}`}
            className="group block cursor-zoom-in overflow-hidden"
            style={siteImageStyle}
          >
            <SiteImg
              src={img.url}
              alt={img.caption ?? ""}
              sizes={thumbSizes}
              className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
          onClick={close}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={onTouchEnd}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 sm:p-8"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous image"
                className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next image"
                className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          <figure
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full max-w-5xl flex-col items-center"
          >
            <SiteImg
              src={active.url}
              alt={active.caption ?? ""}
              priority
              sizes="100vw"
              className="max-h-[82vh] w-auto max-w-full rounded-[6px] object-contain"
            />
            <figcaption className="mt-3 flex items-center gap-3 text-sm text-white/80">
              {count > 1 ? (
                <span className="tabular-nums text-white/60">
                  {(openIndex ?? 0) + 1} / {count}
                </span>
              ) : null}
              {active.caption ? <span>{active.caption}</span> : null}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
