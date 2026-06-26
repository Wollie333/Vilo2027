"use client";

import { useCallback, useEffect, useState } from "react";

type Shot = { src: string; alt: string };

/**
 * Click-to-browse image gallery for the Safari design. On mount it collects the
 * page's gallery images (the suite-hero, the home gallery, framed images) and
 * makes each one open a full-screen viewer you can page through with the
 * arrows / swipe / keyboard. Uses each image's `data-lb-src` (the high-res
 * version) when present. Client-only; renders nothing until an image is opened.
 */
export function SafariLightbox() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        ".vilo-safari .suite-hero img, .vilo-safari .gallery img, .vilo-safari .frame-img img, .vilo-safari [data-lb-src]",
      ),
    );
    const list: Shot[] = [];
    els.forEach((img) => {
      img.dataset.lbIndex = String(list.length);
      img.style.cursor = "zoom-in";
      list.push({
        src: img.getAttribute("data-lb-src") || img.currentSrc || img.src,
        alt: img.alt || "",
      });
    });
    setShots(list);

    // Fill the room gallery's "N photos" indicator.
    document
      .querySelectorAll<HTMLElement>(".vilo-safari [data-lb-count]")
      .forEach((el) => {
        el.textContent = `${list.length} photo${list.length === 1 ? "" : "s"}`;
      });

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // The "view photos" badge opens the gallery at the first image.
      if (target?.closest?.("[data-lb-open]")) {
        e.preventDefault();
        setIdx(0);
        return;
      }
      const img = target?.closest?.("img") as HTMLImageElement | null;
      if (!img || img.dataset.lbIndex == null) return;
      e.preventDefault();
      setIdx(Number(img.dataset.lbIndex));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const close = useCallback(() => setIdx(null), []);
  const step = useCallback(
    (d: number) =>
      setIdx((i) => (i == null ? i : (i + d + shots.length) % shots.length)),
    [shots.length],
  );

  useEffect(() => {
    if (idx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [idx, close, step]);

  if (idx == null || !shots[idx]) return null;
  const shot = shots[idx];

  return (
    <div
      className="safari-lightbox open"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      onClick={close}
    >
      <button
        type="button"
        className="lb-close"
        aria-label="Close"
        onClick={close}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      {shots.length > 1 ? (
        <button
          type="button"
          className="lb-nav lb-prev"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shot.src} alt={shot.alt} onClick={(e) => e.stopPropagation()} />
      {shots.length > 1 ? (
        <button
          type="button"
          className="lb-nav lb-next"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      ) : null}
      {shots.length > 1 ? (
        <span className="lb-count">
          {idx + 1} / {shots.length}
        </span>
      ) : null}
    </div>
  );
}
