"use client";

import { useEffect } from "react";

import {
  loadGa4,
  loadGoogleAds,
  loadGtm,
  loadMetaPixel,
  loadTikTok,
} from "./trackers";

export type PlatformTracking = {
  metaPixelId?: string | null;
  ga4?: string | null;
  gtm?: string | null;
  tiktok?: string | null;
  googleAds?: string | null;
};

/**
 * Loads the WIELO platform's own tracking pixels (admin-configured in Platform
 * Settings → Tracking & pixels) across the Wielo app + directory. Rendered by
 * the root layout ONLY on Wielo surfaces (suppressed on host micro-sites, which
 * fire the host's OWN pixels via SiteMarketing). Injects each configured tracker
 * once; the Meta pixel + GA4 fire their PageView automatically.
 */
export function PlatformMarketing({
  tracking,
}: {
  tracking: PlatformTracking;
}) {
  useEffect(() => {
    const { metaPixelId, ga4, gtm, tiktok, googleAds } = tracking;
    if (ga4) loadGa4(ga4);
    if (metaPixelId) loadMetaPixel(metaPixelId);
    if (gtm) loadGtm(gtm);
    if (tiktok) loadTikTok(tiktok);
    if (googleAds) loadGoogleAds(googleAds);
  }, [tracking]);
  return null;
}
