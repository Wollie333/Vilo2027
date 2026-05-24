"use client";

import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "vilo_cookie_consent";
const COOKIE_NAME = "vilo_cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type ConsentValue = "accepted" | "rejected";

function writeConsentCookie(value: ConsentValue) {
  try {
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage might be blocked; the cookie alone is enough.
  }
}

function readConsent(): ConsentValue | null {
  try {
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage === "accepted" || fromStorage === "rejected") {
      return fromStorage;
    }
    const match = document.cookie.match(
      /(?:^|;\s*)vilo_cookie_consent=(accepted|rejected)/,
    );
    if (match) return match[1] as ConsentValue;
    return null;
  } catch {
    return null;
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent() === null) {
      // Defer one tick so first paint isn't blocked.
      const t = setTimeout(() => setVisible(true), 250);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    writeConsentCookie("accepted");
    setVisible(false);
  };
  const reject = () => {
    writeConsentCookie("rejected");
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-5"
    >
      <div className="pointer-events-auto w-full max-w-3xl rounded-card border border-brand-line bg-white p-4 shadow-card sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
            <Cookie className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm text-brand-ink">
            <p className="font-display font-semibold leading-snug">
              Cookies on Vilo
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-mute">
              We use strictly necessary cookies to keep you signed in and
              protect the platform. Optional analytics help us improve. Read our{" "}
              <Link
                href="/cookies"
                className="font-medium text-brand-primary underline-offset-2 hover:underline"
              >
                cookies policy
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={accept}
                className="inline-flex items-center justify-center rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-secondary"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={reject}
                className="inline-flex items-center justify-center rounded border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
              >
                Strictly necessary only
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={reject}
            aria-label="Dismiss"
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
