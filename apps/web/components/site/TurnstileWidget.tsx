"use client";

import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile for the public write forms (signup, website forms,
// on-site checkout). Produces a one-time token sent to the server as `ts` and
// verified there (lib/security/turnstile.ts).
//
// INERT until configured: with no NEXT_PUBLIC_TURNSTILE_SITE_KEY it renders
// nothing and never produces a token — and the server skips verification too —
// so forms behave exactly as before until the keys are added.
//
// ── Why this component is defensive about failure ──────────────────────────
// Turnstile routinely paints its own red "Failed to connect" box for a few
// seconds before retrying and going green — slow mobile networks, a cold DNS
// lookup, a captive portal. The first version passed that straight through:
// the visitor saw an error, the submit button went dead, and a good number of
// them simply left a signup that would have worked had they waited.
//
// So: the widget's own error state is hidden behind our own calm copy, retries
// are explicit rather than left to defaults, and — the important part — a
// submit that arrives before the token does WAITS for it instead of being
// rejected (see ensureTurnstileToken). A human check the human never notices is
// the whole point of Turnstile; a human check that loses the signup is worse
// than none.

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True when Turnstile is configured. */
export function turnstileEnabled(): boolean {
  return Boolean(TURNSTILE_SITE_KEY);
}

/** How long a submit will wait for a token before giving up. */
const SUBMIT_WAIT_MS = 20_000;
/** How long to look like we are simply loading before admitting trouble. */
const QUIET_GRACE_MS = 12_000;

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
      action?: string;
      retry?: "auto" | "never";
      "retry-interval"?: number;
      "refresh-expired"?: "auto" | "manual" | "never";
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

// ── Token registry ─────────────────────────────────────────────────────────
// Module-level so a submit handler can await the token without the widget
// having to be a parent, a context, or a ref every caller threads through.
let latestToken: string | null = null;
let waiters: Array<(token: string | null) => void> = [];

function publishToken(token: string | null) {
  latestToken = token;
  // Only a REAL token wakes the waiters. Publishing null happens on every
  // transient error and on expiry — waking waiters there would hand a submit
  // the very "it failed" answer this whole mechanism exists to avoid, moments
  // before the retry succeeds.
  if (token) {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve(token);
  }
}

/** Test-only seam for driving the callbacks Cloudflare would otherwise fire. */
export const __publishTokenForTest = publishToken;

/**
 * The token for a submit that is happening NOW.
 *
 * Returns immediately when one is already in hand. Otherwise waits for the
 * challenge to finish — which is the normal case on a slow connection, where
 * the visitor filled the form faster than Cloudflare answered. Resolves null
 * only after SUBMIT_WAIT_MS, at which point the caller decides.
 *
 * Callers should be inside their pending/submitting state when they await this,
 * so the wait reads as "submitting…" rather than as nothing happening.
 */
export function ensureTurnstileToken(
  current: string | null,
  timeoutMs: number = SUBMIT_WAIT_MS,
): Promise<string | null> {
  if (!turnstileEnabled()) return Promise.resolve(null);
  const token = current ?? latestToken;
  if (token) return Promise.resolve(token);
  return new Promise((resolve) => {
    let settled = false;
    const done = (t: string | null) => {
      if (settled) return;
      settled = true;
      resolve(t);
    };
    waiters.push(done);
    setTimeout(() => done(null), timeoutMs);
  });
}

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

type Status = "loading" | "verified" | "struggling";

/**
 * Renders the challenge and reports the token via `onVerify`. Bump `resetSignal`
 * to force a fresh token after a consumed submit (tokens are single-use).
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
  const [status, setStatus] = useState<Status>("loading");

  // After the grace window, stop pretending it is merely slow.
  useEffect(() => {
    if (status !== "loading") return;
    const t = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "struggling" : s));
    }, QUIET_GRACE_MS);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY as string,
          theme: "auto",
          // Cloudflare's account-level activation telemetry (aggregate, never
          // per-user). Harmless to keep; the integration works without it.
          action: "turnstile-spin-v2",
          // Explicit rather than relying on defaults: a transient failure must
          // keep retrying on its own, because the visitor will not know to.
          retry: "auto",
          "retry-interval": 3000,
          "refresh-expired": "auto",
          callback: (token) => {
            setStatus("verified");
            publishToken(token);
            onVerifyRef.current(token);
          },
          "expired-callback": () => {
            setStatus("loading");
            publishToken(null);
            onVerifyRef.current(null);
          },
          // NOT surfaced to the visitor. Turnstile is already retrying; saying
          // "failed" here is what made people leave a form that was about to
          // work. We only clear the token so a submit awaits the next one.
          "error-callback": () => {
            publishToken(null);
            onVerifyRef.current(null);
          },
          "timeout-callback": () => {
            publishToken(null);
            onVerifyRef.current(null);
          },
        });
      })
      .catch(() => {
        // Script blocked entirely (ad-blocker, corporate proxy, offline). Say
        // nothing alarming — the submit path still waits, then proceeds and
        // lets the server decide.
        setStatus("struggling");
        publishToken(null);
        onVerifyRef.current(null);
      });
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

  useEffect(() => {
    if (resetSignal === 0) return;
    if (widgetId.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
        setStatus("loading");
        publishToken(null);
        onVerifyRef.current(null);
      } catch {
        // ignore
      }
    }
  }, [resetSignal]);

  function retryNow() {
    setStatus("loading");
    if (widgetId.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        // ignore
      }
    }
  }

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className={className}>
      {/* Cloudflare draws into this. Kept mounted always — hiding it would
          cancel the very retry we are waiting on. */}
      <div ref={ref} />

      {status === "loading" ? (
        <p className="mt-1.5 text-[12px] text-brand-mute">
          Checking your browser… you can carry on filling in the form.
        </p>
      ) : null}

      {status === "struggling" ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-brand-mute">
          The security check is taking longer than usual — this is usually a
          slow connection, and it keeps trying on its own.{" "}
          <strong className="text-brand-ink">
            You can still submit the form.
          </strong>{" "}
          <button
            type="button"
            onClick={retryNow}
            className="font-semibold text-brand-primary underline underline-offset-2"
          >
            Try the check again
          </button>
        </p>
      ) : null}
    </div>
  );
}
