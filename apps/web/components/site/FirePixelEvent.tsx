"use client";

import { useEffect } from "react";

/**
 * Fires a standard Meta Pixel event (e.g. Lead / Subscribe) + a GA4/GTM dataLayer
 * push, once on mount. Used by the conversion-goal thank-you pages so each goal
 * records its own event. No-ops when the pixel isn't loaded (preview / no pixel
 * configured). `dataLayer` + `fbq` are declared globally in lib/analytics/purchase.
 */
export function FirePixelEvent({
  event,
  params,
}: {
  event: string;
  params?: Record<string, unknown>;
}) {
  useEffect(() => {
    if (!event) return;
    // GA4/GTM dataLayer push — immediate + reliable.
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: `vilo_${event.toLowerCase()}`,
      ...(params ?? {}),
    });
    // The Meta pixel (fbq) loads only after cookie-consent + an async script, so
    // it may not exist on mount. Fire as soon as it appears (poll ~3s), then stop.
    const fire = () => {
      if (typeof window.fbq === "function") {
        window.fbq("track", event, params ?? {});
        return true;
      }
      return false;
    };
    if (fire()) return;
    let tries = 0;
    const iv = window.setInterval(() => {
      if (fire() || (tries += 1) > 30) window.clearInterval(iv);
    }, 100);
    return () => window.clearInterval(iv);
  }, [event, params]);
  return null;
}
