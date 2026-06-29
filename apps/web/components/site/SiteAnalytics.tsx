"use client";

import { useEffect } from "react";

/**
 * Cookieless pageview beacon for the public micro-site (Phase 0A). Renders
 * nothing; on mount it POSTs one `pageview` to `/api/site-track`, which derives
 * device/country/session server-side. Never mounted in preview mode (the editor
 * shouldn't pollute the host's stats). Uses `sendBeacon` so the request survives
 * a fast navigation, falling back to a keepalive fetch.
 */
export function SiteAnalytics({ websiteId }: { websiteId: string }) {
  useEffect(() => {
    if (!websiteId) return;

    const send = (event: "pageview" | "booking_click") => {
      const payload = JSON.stringify({
        websiteId,
        event,
        path: window.location.pathname,
        referrer: document.referrer || null,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/site-track",
            new Blob([payload], { type: "application/json" }),
          );
        } else {
          void fetch("/api/site-track", {
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

    // Pageview on mount.
    send("pageview");

    // Booking-click via event delegation: any anchor/button marked
    // `data-wielo-book` (header CTA, room cards, CTA bands) counts as a
    // conversion intent, so we can show real booking-click conversion.
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-wielo-book]")) send("booking_click");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, true);
  }, [websiteId]);

  return null;
}
