"use client";

import { useEffect, useRef, useState } from "react";

import type { SiteAnalyticsSettings } from "@/lib/site/types";
import { CONSENT_KEY, writeConsent } from "@/lib/site/consent";

// Host third-party analytics on a tenant site: Google Analytics 4 + Meta
// (Facebook) Pixel, gated behind a POPIA cookie-consent banner. The IDs are the
// HOST's own (configured in Website → Settings); we only inject the scripts.
//
// POPIA: these set cookies, so by default the pixels load ONLY after the visitor
// accepts the banner. The host can turn the gate off (consent not required), in
// which case the pixels load immediately. In builder/preview (`interactive`
// false) nothing is injected and no choice is persisted — so previews never
// pollute the host's real analytics.

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: unknown;
};

// `dataLayer` + `fbq` are declared globally in lib/analytics/purchase.ts; only
// add `_fbq` here (the Meta bootstrap alias).
declare global {
  interface Window {
    _fbq?: unknown;
  }
}

// Inject once per page, even across re-renders.
const injected = new Set<string>();

function dataLayerPush(entry: unknown) {
  window.dataLayer = window.dataLayer ?? [];
  (window.dataLayer as unknown as unknown[]).push(entry);
}

// gtag.js is shared by GA4 + Google Ads — load the library once, then `config`
// each id. `dataLayer` is typed as Record[] globally, so push via an unknown view.
function ensureGtagLib(firstId: string) {
  if (injected.has("gtag-lib")) return;
  injected.add("gtag-lib");
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(firstId)}`;
  document.head.appendChild(s);
  dataLayerPush(["js", new Date()]);
}

function loadGa4(id: string) {
  if (injected.has(`ga4:${id}`)) return;
  injected.add(`ga4:${id}`);
  ensureGtagLib(id);
  dataLayerPush(["config", id]);
}

function loadGoogleAds(id: string) {
  if (injected.has(`gads:${id}`)) return;
  injected.add(`gads:${id}`);
  ensureGtagLib(id);
  dataLayerPush(["config", id]);
}

function loadGtm(id: string) {
  if (injected.has(`gtm:${id}`)) return;
  injected.add(`gtm:${id}`);
  dataLayerPush({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

// TikTok pixel bootstrap (the vendor snippet, typed to avoid `any`).
type Ttq = {
  push: (args: unknown[]) => void;
  methods?: string[];
  setAndDefer?: (t: Ttq, e: string) => void;
  load?: (id: string) => void;
  page?: () => void;
  _i?: Record<string, unknown>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
  [k: string]: unknown;
};

function loadTikTok(id: string) {
  if (injected.has(`ttq:${id}`)) return;
  injected.add(`ttq:${id}`);
  const w = window as unknown as { TiktokAnalyticsObject?: string; ttq?: Ttq };
  w.TiktokAnalyticsObject = "ttq";
  const ttq: Ttq = w.ttq ?? ([] as unknown as Ttq);
  w.ttq = ttq;
  ttq.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
  ];
  ttq.setAndDefer = (t: Ttq, e: string) => {
    t[e] = (...args: unknown[]) => t.push([e, ...args]);
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.load = (e: string) => {
    const n = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i ?? {};
    ttq._i[e] = [];
    (ttq._i[e] as unknown as { _u?: string })._u = n;
    ttq._t = ttq._t ?? {};
    ttq._t[e] = +new Date();
    ttq._o = ttq._o ?? {};
    ttq._o[e] = {};
    const s = document.createElement("script");
    s.async = true;
    s.src = `${n}?sdkid=${encodeURIComponent(e)}&lib=ttq`;
    document.head.appendChild(s);
  };
  ttq.load(id);
  (ttq.page as () => void)();
}

function loadMetaPixel(id: string) {
  if (injected.has(`fbq:${id}`)) return;
  injected.add(`fbq:${id}`);
  if (!window.fbq) {
    const n: FbqFn = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else (n.queue = n.queue ?? []).push(args);
    } as FbqFn;
    n.queue = [];
    n.loaded = true;
    n.version = "2.0";
    n.push = n;
    window.fbq = n;
    window._fbq = window._fbq ?? n;
    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(t);
  }
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

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
