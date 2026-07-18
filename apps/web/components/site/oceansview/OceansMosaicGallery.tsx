"use client";

import { useCallback, useEffect, useState } from "react";

export type OceansMosaicImage = { url: string; caption?: string | null };

/**
 * Oceans View home gallery — the reference mosaic (`.mosaic`/`.m`, with a big
 * lead tile) + a full lightbox SLIDER (‹ › arrows, keyboard, counter) over ALL
 * the property's photos. Reuses the room lightbox styles (`.ovroom-lightbox`).
 */
export function OceansMosaicGallery({
  images,
  brandName,
}: {
  images: OceansMosaicImage[];
  brandName: string;
}) {
  const shots = images.filter((i) => i.url);
  const [idx, setIdx] = useState<number | null>(null);
  const open = idx !== null;

  const go = useCallback(
    (delta: number) =>
      setIdx((i) =>
        i === null ? i : (i + delta + shots.length) % shots.length,
      ),
    [shots.length],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, go]);

  if (shots.length === 0) return null;

  // Feature the first tile large; give one mid-row tile double width for rhythm
  // (mirrors the reference mosaic). Falls out cleanly for any photo count.
  const spanClass = (i: number) => {
    if (i === 0) return "m w2 h2";
    if (shots.length >= 6 && i === 5) return "m w2";
    return "m";
  };
  const tiles = shots.slice(0, 6);
  const multiple = shots.length > 1;

  return (
    <>
      <div className="mosaic">
        {tiles.map((img, i) => (
          <div className={spanClass(i)} key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.caption ?? `${brandName} — photo ${i + 1}`}
              onClick={() => setIdx(i)}
              style={{ cursor: "zoom-in" }}
            />
          </div>
        ))}
      </div>

      {open ? (
        <div
          className="ovroom-lightbox open"
          onClick={() => setIdx(null)}
          role="presentation"
        >
          <button
            type="button"
            className="ovlb-close"
            onClick={() => setIdx(null)}
            aria-label="Close"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          {multiple ? (
            <button
              type="button"
              className="ovlb-arrow ovlb-prev"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous photo"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shots[idx].url}
            alt={shots[idx].caption ?? `${brandName} — photo ${idx + 1}`}
            onClick={(e) => e.stopPropagation()}
          />
          {multiple ? (
            <button
              type="button"
              className="ovlb-arrow ovlb-next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next photo"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          ) : null}
          {multiple ? (
            <div className="ovlb-count" onClick={(e) => e.stopPropagation()}>
              {idx + 1} / {shots.length}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
