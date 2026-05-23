"use client";

import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type GalleryPhoto = { id: string; url: string };

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

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
      <div className="relative grid gap-2 sm:grid-cols-2 sm:grid-rows-2">
        <button
          type="button"
          onClick={() => setOpenIdx(0)}
          className="group relative aspect-[4/3] overflow-hidden rounded-card sm:row-span-2"
          aria-label="Open hero photo"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.url}
            alt="Listing"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </button>

        {grid.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIdx(i + 1)}
            className="group relative aspect-[4/3] overflow-hidden rounded-card"
            aria-label={`Open photo ${i + 2}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt="Listing"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}

        {photos.length > 5 ? (
          <button
            type="button"
            onClick={() => setOpenIdx(0)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-pill bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-card hover:bg-brand-accent"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Show all {photos.length} photos
          </button>
        ) : null}
      </div>

      {openIdx != null ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
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
                className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:left-6"
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
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:right-6"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}

          <div
            className="relative mx-4 max-h-[90vh] max-w-6xl"
            onClick={(e) => e.stopPropagation()}
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
        </div>
      ) : null}
    </>
  );
}
