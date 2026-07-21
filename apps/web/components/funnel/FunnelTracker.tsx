"use client";

import { useEffect, useRef } from "react";

import type { FunnelEvent } from "@/lib/funnel/shared";

// WS-7 — browser half of the Wielo funnel beacon (mirrors SiteAnalytics, which
// does the same for host micro-sites). Cookieless: the server derives session,
// device and country from the request. Best-effort by design — a failed beacon
// must never surface to a visitor or block a step.

/** Fire one funnel event. Safe to call from anywhere in the browser. */
export function trackFunnel(event: FunnelEvent, step?: string) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    event,
    step: step ?? null,
    referrer: document.referrer || null,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/funnel-track",
        new Blob([payload], { type: "application/json" }),
      );
    } else {
      void fetch("/api/funnel-track", {
        method: "POST",
        body: payload,
        headers: { "content-type": "application/json" },
        keepalive: true,
      });
    }
  } catch {
    // Never surface tracking errors to a visitor.
  }
}

/** Drop-in "this page was viewed" beacon. Renders nothing. */
export function FunnelTracker({
  event,
  step,
}: {
  event: FunnelEvent;
  step?: string;
}) {
  // Fire once per (event, step) for the life of this mount. React StrictMode
  // double-invokes effects in dev, and a remount would otherwise double-count
  // the top of the funnel — which is the denominator of every ratio below it.
  const fired = useRef<string | null>(null);
  useEffect(() => {
    const key = `${event}:${step ?? ""}`;
    if (fired.current === key) return;
    fired.current = key;
    trackFunnel(event, step);
  }, [event, step]);
  return null;
}
