"use client";

import { ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { GalleryImage } from "@/lib/site/types";

import { siteImageStyle } from "./sections/_shared";
import { SiteImg } from "./SiteImg";

// Gallery tiles ride the theme image style, but let the block's "Image" element
// override radius / border / shadow (`--el-image-*`, set on the block wrapper).
const galleryTileStyle = {
  ...siteImageStyle,
  borderRadius: "var(--el-image-radius, var(--site-img-radius))",
  border: "var(--el-image-bd, var(--site-img-border))",
  boxShadow: "var(--el-image-shadow, var(--site-img-shadow))",
};

/**
 * Gallery grid + swipeable fullscreen lightbox (Phase 7c). The grid mirrors the
 * three section layouts (grid / list / carousel); clicking any tile opens a
 * themed overlay with prev/next, keyboard arrows, touch-swipe, a counter and a
 * caption. Thumbnails and the full image both ride the Supabase transform
 * pipeline via <SiteImg>, so each is sized to its slot.
 */
const GAP_PX = { sm: 6, md: 12, lg: 24 } as const;

export function GalleryLightbox({
  images,
  layout,
  gap,
}: {
  images: GalleryImage[];
  layout?: "grid" | "list" | "carousel" | "mosaic";
  gap?: "sm" | "md" | "lg";
}) {
  const gapPx = GAP_PX[gap ?? "md"];
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

  // Directory-style hero mosaic: one large image + a 2×2 grid of thumbnails and
  // a "Show all N photos" button. Any tile opens the same fullscreen lightbox.
  // The hero spans half the grid at EVERY size (was full-width + hidden thumbs on
  // mobile — which showed just one photo); the thumbnails now fill the other half
  // on mobile too, so the mosaic reads as designed on phones.
  const mosaic = layout === "mosaic" && count > 0;
  const heroSpan = count > 1 ? "col-span-2" : "col-span-4";

  return (
    <>
      {mosaic ? (
        <>
          {/* Mobile: a clean equal 2-col grid — the hero mosaic needs width to
            breathe, so on phones every photo shows at the same size instead. */}
          <div className="grid grid-cols-2 sm:hidden" style={{ gap: gapPx }}>
            {images.slice(0, 6).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIndex(i)}
                aria-label={img.caption || `View photo ${i + 1}`}
                className="group relative cursor-zoom-in overflow-hidden"
                style={galleryTileStyle}
              >
                <SiteImg
                  src={img.url}
                  alt={img.caption ?? ""}
                  sizes="50vw"
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </button>
            ))}
          </div>
          {/* sm+: the designed directory-style hero mosaic. */}
          <div
            className="relative hidden h-[460px] grid-cols-4 grid-rows-2 overflow-hidden sm:grid"
            style={{ ...galleryTileStyle, gap: gapPx }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(0)}
              aria-label={images[0].caption || "View photo 1"}
              className={`group relative row-span-2 cursor-zoom-in overflow-hidden ${heroSpan}`}
            >
              <SiteImg
                src={images[0].url}
                alt={images[0].caption ?? ""}
                priority
                sizes="(min-width: 640px) 50vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </button>
            {images.slice(1, 5).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setOpenIndex(i + 1)}
                aria-label={img.caption || `View photo ${i + 2}`}
                className="group relative block cursor-zoom-in overflow-hidden"
                style={{ background: "var(--site-bg)" }}
              >
                <SiteImg
                  src={img.url}
                  alt={img.caption ?? ""}
                  sizes="25vw"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpenIndex(0)}
              style={{
                background: "var(--site-surface)",
                borderColor: "var(--site-line)",
                color: "var(--site-ink)",
                borderRadius: "var(--site-radius)",
              }}
              className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-medium shadow-lift transition hover:opacity-90"
            >
              <LayoutGrid className="h-4 w-4" />
              View all {count} photo{count === 1 ? "" : "s"}
            </button>
          </div>
        </>
      ) : (
        <div className={`grid ${cols}`} style={{ gap: gapPx }}>
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={img.caption || `View image ${i + 1}`}
              className="group block cursor-zoom-in overflow-hidden"
              style={galleryTileStyle}
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
      )}

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
