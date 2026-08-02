"use client";

import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  LayoutGrid,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type GalleryPhoto = { id: string; url: string };

/**
 * Shared listing/stay photo gallery: a responsive bento grid that opens a
 * full-screen lightbox you can slide through — arrows, keyboard (←/→/Esc) AND
 * touch-swipe on mobile. The lightbox is portalled to document.body at a very
 * high z-index so it always clears app chrome (the portal sidebar/header sit in
 * an overflow container that would otherwise stacking-trap an inline overlay).
 * Used by the public listing pages and the guest portal trip page.
 */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpenIdx(null), []);
  const prev = useCallback(() => {
    setOpenIdx((i) =>
      i == null ? null : (i - 1 + photos.length) % photos.length,
    );
  }, [photos.length]);
  const next = useCallback(() => {
    setOpenIdx((i) => (i == null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (openIdx == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIdx, close, prev, next]);

  // Touch-swipe on the lightbox image (mobile "slide through").
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) < 40) return; // ignore taps / tiny drags
    if (dx < 0) next();
    else prev();
  }

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-card border border-dashed border-brand-line bg-brand-accent/40 text-brand-mute">
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="h-8 w-8" />
          <span className="text-sm font-medium">No photos yet</span>
        </div>
      </div>
    );
  }

  const [hero, ...rest] = photos;
  const grid = rest.slice(0, 4);

  return (
    <>
      <section className="relative grid h-[300px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card sm:h-[420px]">
        <button
          type="button"
          onClick={() => setOpenIdx(0)}
          className="group relative col-span-4 row-span-2 overflow-hidden bg-brand-accent sm:col-span-2"
          aria-label="Open photos"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.url}
            alt="Listing"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/5" />
        </button>

        {grid.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIdx(i + 1)}
            className="group relative hidden overflow-hidden bg-brand-accent sm:block"
            aria-label={`Open photo ${i + 2}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt="Listing"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}

        <button
          type="button"
          onClick={() => setOpenIdx(0)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-[13px] font-medium text-brand-ink shadow-lift hover:bg-brand-light sm:bottom-4 sm:right-4 sm:px-4 sm:py-2 sm:text-sm"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Show all </span>
          {photos.length} photo{photos.length === 1 ? "" : "s"}
        </button>
      </section>

      {openIdx != null && mounted
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
              onClick={close}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4 sm:top-4"
              >
                <X className="h-5 w-5" />
              </button>

              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      prev();
                    }}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4 md:left-6"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      next();
                    }}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4 md:right-6"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}

              <div
                className="relative mx-4 max-h-[90vh] max-w-6xl"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[openIdx].url}
                  alt={`Photo ${openIdx + 1}`}
                  className="max-h-[90vh] w-auto rounded-card object-contain"
                />
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-pill bg-white/10 px-3 py-1 font-mono text-xs text-white">
                {openIdx + 1} / {photos.length}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
