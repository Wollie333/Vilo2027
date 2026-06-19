"use client";

import { useEffect } from "react";

/**
 * Cookieless conversion beacon for the public platform special-detail page
 * (S6b). Renders nothing; on mount it POSTs one `special_view` to
 * `/api/special-track`, which derives device/country/session server-side. Any
 * click on an element marked `data-special-book` (the Book CTA) fires a
 * `special_book_click`, so the report can show real view→booking intent. Uses
 * `sendBeacon` so the request survives a fast navigation, falling back to a
 * keepalive fetch.
 */
export function SpecialTracker({ specialId }: { specialId: string }) {
  useEffect(() => {
    if (!specialId) return;

    const send = (event: "special_view" | "special_book_click") => {
      const payload = JSON.stringify({
        specialId,
        event,
        referrer: document.referrer || null,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/special-track",
            new Blob([payload], { type: "application/json" }),
          );
        } else {
          void fetch("/api/special-track", {
            method: "POST",
            body: payload,
            headers: { "content-type": "application/json" },
            keepalive: true,
          });
        }
      } catch {
        // Tracking is best-effort; never surface errors to a visitor.
      }
    };

    // View on mount.
    send("special_view");

    // Book-CTA click via event delegation.
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-special-book]")) send("special_book_click");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, true);
  }, [specialId]);

  return null;
}
