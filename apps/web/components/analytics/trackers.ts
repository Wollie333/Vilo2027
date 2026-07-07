// Third-party tracking script injectors (GA4 / Google Ads / GTM / TikTok / Meta
// Pixel). Client-only — each function injects the vendor snippet once per page
// (deduped via the module-level `injected` set) and is idempotent. Shared by the
// host-site loader (SiteMarketing, gated behind the host's cookie consent) and
// the Wielo platform loader (PlatformMarketing). `dataLayer` + `fbq` are declared
// globally in lib/analytics/purchase.ts.

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: unknown;
};

declare global {
  interface Window {
    _fbq?: unknown;
  }
}

// Inject once per page, even across re-renders + across both loaders.
const injected = new Set<string>();

function dataLayerPush(entry: unknown) {
  window.dataLayer = window.dataLayer ?? [];
  (window.dataLayer as unknown as unknown[]).push(entry);
}

// gtag.js is shared by GA4 + Google Ads — load the library once, then `config`
// each id.
function ensureGtagLib(firstId: string) {
  if (injected.has("gtag-lib")) return;
  injected.add("gtag-lib");
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(firstId)}`;
  document.head.appendChild(s);
  dataLayerPush(["js", new Date()]);
}

export function loadGa4(id: string) {
  if (injected.has(`ga4:${id}`)) return;
  injected.add(`ga4:${id}`);
  ensureGtagLib(id);
  dataLayerPush(["config", id]);
}

export function loadGoogleAds(id: string) {
  if (injected.has(`gads:${id}`)) return;
  injected.add(`gads:${id}`);
  ensureGtagLib(id);
  dataLayerPush(["config", id]);
}

export function loadGtm(id: string) {
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

export function loadTikTok(id: string) {
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

export function loadMetaPixel(id: string) {
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
