"use client";

import { useEffect, useRef } from "react";

import { firePixelEventWithRetry, newEventId } from "@/lib/analytics/pixel";
import { useConsentGranted } from "@/lib/site/consent";

/**
 * Fires a standard Meta Pixel event (ViewContent / InitiateCheckout / Lead /
 * Subscribe …) + a GA4/GTM dataLayer push, ONCE, on page load. POPIA: gated
 * behind cookie-consent (pass `consentRequired={false}` when the host disabled
 * the gate, or on the Wielo app where the platform pixel isn't consent-gated).
 * No-ops when the pixel isn't loaded; the fbq call retries for ~3s in case the
 * pixel script is still loading (it loads async + only after consent).
 *
 * Fires exactly once per mount (a ref guards against StrictMode's double-invoke
 * and any re-render), and carries an `eventID` for browser↔CAPI dedup — pass a
 * stable `eventId` for refresh-safe events, else a per-mount id is generated.
 */
export function FirePixelEvent({
  event,
  params,
  consentRequired = true,
  eventId,
}: {
  event: string;
  params?: Record<string, unknown>;
  consentRequired?: boolean;
  /** Stable id for refresh-safe dedup; omit to generate one per mount. */
  eventId?: string;
}) {
  const granted = useConsentGranted(consentRequired);
  const firedRef = useRef(false);
  const idRef = useRef<string>();
  if (!idRef.current) idRef.current = eventId ?? newEventId(event);

  useEffect(() => {
    if (!event || !granted || firedRef.current) return;
    firedRef.current = true;
    firePixelEventWithRetry(event, params ?? {}, idRef.current);
  }, [event, params, granted]);
  return null;
}
