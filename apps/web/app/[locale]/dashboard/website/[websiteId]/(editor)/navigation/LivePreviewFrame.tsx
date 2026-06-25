"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows the host's ACTUAL rendered header by embedding the live preview site in a
 * scaled, cropped iframe — true WYSIWYG (real theme, fonts, colours, logo, layout,
 * menu + book button), not a stylised mini-frame. Reads the draft (`preview=1`) so
 * it reflects the host's latest saved navigation; `embed=1` hides the preview
 * banner. Non-interactive (pointer-events off).
 */
export function LivePreviewFrame({
  subdomain,
  cropHeight = 132,
}: {
  subdomain: string;
  /** Visible slice of the page at full render width (px) — the header band. */
  cropHeight?: number;
}) {
  const RENDER_W = 1280;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / RENDER_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        height: cropHeight * scale,
        overflow: "hidden",
        background: "#fff",
        position: "relative",
      }}
    >
      <iframe
        src={`/en/site?site=${encodeURIComponent(subdomain)}&preview=1&embed=1`}
        title="Header preview"
        loading="lazy"
        scrolling="no"
        style={{
          width: RENDER_W,
          height: 1400,
          border: 0,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
