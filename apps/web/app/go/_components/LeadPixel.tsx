"use client";

import { useEffect, useRef } from "react";

import { firePixelEventWithRetry, newEventId } from "@/lib/analytics/pixel";

// Fires the Meta/GA4 `Lead` conversion on the funnel thank-you page (a lead was
// captured, then redirected here). Uses the retry variant because the pixel
// script may still be loading; the GA4/GTM dataLayer push (`vilo_lead`) happens
// immediately so a GTM container can relay it to any configured tag. No-ops when
// no pixel is configured. Guarded so React Strict-mode's double effect fires once.
export function LeadPixel({
  audience,
  funnelName,
}: {
  audience: string;
  funnelName: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    firePixelEventWithRetry(
      "Lead",
      { content_name: funnelName, content_category: audience },
      newEventId("lead"),
    );
  }, [audience, funnelName]);
  return null;
}
