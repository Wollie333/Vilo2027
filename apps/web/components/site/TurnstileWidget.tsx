"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget for the public tenant-site write forms (website
// form submit + on-site checkout). Produces a one-time token sent to the server
// as `ts` and verified there (lib/security/turnstile.ts).
//
// INERT until configured: with no NEXT_PUBLIC_TURNSTILE_SITE_KEY it renders
// nothing and never produces a token — and the server skips verification too —
// so forms behave exactly as before until the founder adds the keys. Theme-aware
// via the explicit-render API. Pure presentational; safe in any --site-* surface.

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True when Turnstile is configured — consumers gate their submit on a token. */
export function turnstileEnabled(): boolean {
  return Boolean(TURNSTILE_SITE_KEY);
}

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
      theme?: "auto" | "light" | "dark";
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __viloTurnstileLoading?: Promise<void>;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Load the Turnstile script once per page (shared across all widgets). */
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__viloTurnstileLoading) return window.__viloTurnstileLoading;
  window.__viloTurnstileLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });
  return window.__viloTurnstileLoading;
}

/**
 * Renders the Turnstile challenge and reports the verification token via
 * `onVerify` (and `onVerify(null)` when the token expires or errors, so the
 * consumer can re-disable its submit). Bump `resetSignal` to force a fresh token
 * after a consumed/failed submit (tokens are single-use).
 */
export function TurnstileWidget({
  onVerify,
  resetSignal = 0,
  className,
}: {
  onVerify: (token: string | null) => void;
  resetSignal?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  // Render once on mount (when configured); clean up on unmount.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY as string,
          theme: "auto",
          callback: (token) => onVerifyRef.current(token),
          "expired-callback": () => onVerifyRef.current(null),
          "error-callback": () => onVerifyRef.current(null),
          "timeout-callback": () => onVerifyRef.current(null),
        });
      })
      .catch(() => onVerifyRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // already gone
        }
      }
    };
  }, []);

  // Force a fresh token when asked (after a submit consumes the previous one).
  useEffect(() => {
    if (resetSignal === 0) return;
    if (widgetId.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
        onVerifyRef.current(null);
      } catch {
        // ignore
      }
    }
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className={className} />;
}
