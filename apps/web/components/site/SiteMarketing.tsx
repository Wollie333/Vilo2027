"use client";

import { useEffect, useRef, useState } from "react";

import {
  loadGa4,
  loadGoogleAds,
  loadGtm,
  loadMetaPixel,
  loadTikTok,
} from "@/components/analytics/trackers";
import type { SiteAnalyticsSettings } from "@/lib/site/types";
import { CONSENT_KEY, writeConsent } from "@/lib/site/consent";

// Host third-party analytics on a tenant site: Google Analytics 4 + Meta
// (Facebook) Pixel + GTM + TikTok + Google Ads, gated behind a POPIA
// cookie-consent banner. The IDs are the HOST's own (configured in Website →
// Settings); the script injectors are shared with the Wielo platform loader
// (components/analytics/trackers.ts).
//
// POPIA: these set cookies, so by default the pixels load ONLY after the visitor
// accepts the banner. The host can turn the gate off (consent not required), in
// which case the pixels load immediately. In builder/preview (`interactive`
// false) nothing is injected and no choice is persisted — so previews never
// pollute the host's real analytics.

export function SiteMarketing({
  analytics,
  interactive = false,
}: {
  analytics?: SiteAnalyticsSettings;
  interactive?: boolean;
}) {
  const ga4 = analytics?.ga4?.trim() || "";
  const pixel = analytics?.metaPixel?.trim() || "";
  const gtm = analytics?.gtm?.trim() || "";
  const tiktok = analytics?.tiktok?.trim() || "";
  const googleAds = analytics?.googleAds?.trim() || "";
  const hasAnalytics = Boolean(ga4 || pixel || gtm || tiktok || googleAds);
  const consentRequired = analytics?.cookieConsent?.enabled !== false;

  // null = undecided; in non-consent mode we treat it as accepted immediately.
  const [consent, setConsent] = useState<"accepted" | "declined" | null>(null);
  const decided = useRef(false);

  // Resolve the initial consent state on the client (localStorage).
  useEffect(() => {
    if (!hasAnalytics) return;
    if (!consentRequired) {
      setConsent("accepted");
      return;
    }
    if (!interactive) return; // preview: show the banner, persist nothing
    try {
      const prior = window.localStorage.getItem(CONSENT_KEY);
      if (prior === "accepted" || prior === "declined") setConsent(prior);
    } catch {
      // localStorage blocked — leave undecided (banner shows).
    }
  }, [hasAnalytics, consentRequired, interactive]);

  // Inject the pixels once consent is granted (real visits only).
  useEffect(() => {
    if (!interactive || consent !== "accepted") return;
    if (ga4) loadGa4(ga4);
    if (pixel) loadMetaPixel(pixel);
    if (gtm) loadGtm(gtm);
    if (tiktok) loadTikTok(tiktok);
    if (googleAds) loadGoogleAds(googleAds);
  }, [interactive, consent, ga4, pixel, gtm, tiktok, googleAds]);

  if (!hasAnalytics) return null;

  function choose(value: "accepted" | "declined") {
    decided.current = true;
    setConsent(value);
    // Persist + broadcast so the per-page events / custom code (which gate on the
    // same consent signal) light up without a reload. Preview persists nothing.
    if (interactive) writeConsent(value);
  }

  // Banner shows only when consent is required and still undecided.
  if (!consentRequired || consent !== null) return null;

  const message =
    analytics?.cookieConsent?.message?.trim() ||
    "We use cookies to analyse traffic and improve your experience.";
  const privacyHref = analytics?.cookieConsent?.privacyHref?.trim() || "";

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        background: "var(--site-surface)",
        borderColor: "var(--site-line)",
        color: "var(--site-ink)",
      }}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border p-4 shadow-lift sm:flex sm:items-center sm:gap-4"
    >
      <p
        style={{ color: "var(--site-mute)" }}
        className="flex-1 text-sm leading-relaxed"
      >
        {message}{" "}
        {privacyHref ? (
          <a
            href={privacyHref}
            style={{ color: "var(--site-ink)" }}
            className="font-medium underline"
          >
            Learn more
          </a>
        ) : null}
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button
          type="button"
          onClick={() => choose("declined")}
          style={{
            borderColor: "var(--site-line)",
            color: "var(--site-ink)",
            borderRadius: "var(--site-radius)",
          }}
          className="border px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => choose("accepted")}
          style={{
            background: "var(--site-btn-primary-bg)",
            color: "var(--site-btn-primary-color)",
            border: "var(--site-btn-primary-border)",
            borderRadius: "var(--site-btn-primary-radius)",
          }}
          className="px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
