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
    if (typeof window.fbq === "function") {
      window.fbq("track", event, params ?? {});
    }
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: `vilo_${event.toLowerCase()}`,
      ...(params ?? {}),
    });
  }, [event, params]);
  return null;
}
