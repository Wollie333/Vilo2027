"use client";

import { useState } from "react";

export type OceansGalleryImage = { url: string; alt?: string | null };

/**
 * Oceans View room gallery — the reference mosaic (one tall main photo + two
 * stacked side photos) with a "View all N photos" pill and a click-to-zoom
 * lightbox. Falls back gracefully to whatever photos exist (1, 2 or 3+).
 */
export function OceansRoomGallery({
  images,
  roomName,
}: {
  images: OceansGalleryImage[];
  roomName: string;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const shots = images.filter((i) => i.url);
  if (shots.length === 0) return null;

  const [main, ...rest] = shots;
  const side = rest.slice(0, 2);

  return (
    <>
      <div className="rgal">
        <div className="g main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.url}
            alt={main.alt ?? roomName}
            onClick={() => setLightbox(main.url)}
          />
          <button
            type="button"
            className="gcount"
            onClick={() => setLightbox(main.url)}
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
              src={img.url}
              alt={img.alt ?? roomName}
              onClick={() => setLightbox(img.url)}
            />
          </div>
        ))}
        {/* Keep the mosaic shape when there are fewer than 3 photos. */}
        {side.length === 0 ? (
          <>
            <div className="g" aria-hidden style={{ opacity: 0 }} />
            <div className="g" aria-hidden style={{ opacity: 0 }} />
          </>
        ) : side.length === 1 ? (
          <div className="g" aria-hidden style={{ opacity: 0 }} />
        ) : null}
      </div>

      <div
        className={`ovroom-lightbox${lightbox ? "open" : ""}`}
        onClick={() => setLightbox(null)}
        role="presentation"
      >
        {lightbox ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lightbox} alt={`${roomName} — enlarged`} />
        ) : null}
      </div>
    </>
  );
}
