"use client";

import { useCallback, useEffect, useState } from "react";

import { siteImageUrl } from "@/lib/site/image";

export type OceansGalleryImage = { url: string; alt?: string | null };

/**
 * Oceans View room gallery — the reference mosaic (one tall main photo + two
 * stacked side photos) with a "View all N photos" pill and a full LIGHTBOX
 * SLIDER: click any photo to open, then browse ALL the room's images with the
 * on-screen ‹ › arrows, the keyboard (←/→, Esc) or the counter. Cycles wrap.
 */
export function OceansRoomGallery({
  images,
  roomName,
}: {
  images: OceansGalleryImage[];
  roomName: string;
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
    // Lock body scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, go]);

  if (shots.length === 0) return null;

  const [main, ...rest] = shots;
  const side = rest.slice(0, 2);
  const multiple = shots.length > 1;

  return (
    <>
      <div className="rgal">
        <div className="g main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(main.url, { width: 1600 })}
            alt={main.alt ?? roomName}
            onClick={() => setIdx(0)}
          />
          <button
            type="button"
            className="gcount"
            onClick={() => setIdx(0)}
            aria-label="View all photos"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            View all {shots.length} photo{shots.length === 1 ? "" : "s"}
          </button>
        </div>
        {side.map((img, i) => (
          <div className="g" key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(img.url, { width: 900 })}
              alt={img.alt ?? roomName}
              onClick={() => setIdx(1 + i)}
            />
          </div>
        ))}
        {side.length === 0 ? (
          <>
            <div className="g" aria-hidden style={{ opacity: 0 }} />
            <div className="g" aria-hidden style={{ opacity: 0 }} />
          </>
        ) : side.length === 1 ? (
          <div className="g" aria-hidden style={{ opacity: 0 }} />
        ) : null}
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
            src={siteImageUrl(shots[idx].url, { width: 2000 })}
            alt={shots[idx].alt ?? `${roomName} — photo ${idx + 1}`}
            onClick={(e) => e.stopPropagation()}
            loading="lazy"
            decoding="async"
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
