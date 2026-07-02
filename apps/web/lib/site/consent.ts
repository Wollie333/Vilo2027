"use client";

import { useEffect, useState } from "react";

// Shared POPIA cookie-consent signal for the public tenant site. `SiteMarketing`
// owns the banner + persists the choice to localStorage; anything that sets
// cookies / fires tracking (pixels, per-page events, custom head/body code) gates
// on this so nothing runs before the visitor accepts.

export const CONSENT_KEY = "wielo-cookie-consent"; // "accepted" | "declined"
/** Dispatched on `window` when the visitor accepts/declines (same tab). */
export const CONSENT_EVENT = "wielo-consent-change";

export type ConsentState = "accepted" | "declined" | null;

export function readConsent(): ConsentState {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

/** Persist the choice + notify same-tab listeners (other tabs get `storage`). */
export function writeConsent(value: "accepted" | "declined"): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // ignore (private mode / blocked storage)
  }
  try {
    window.dispatchEvent(new Event(CONSENT_EVENT));
  } catch {
    // ignore
  }
}

/**
 * True when tracking may run: immediately if consent isn't required (host turned
 * the gate off), otherwise only once the visitor has accepted. Re-evaluates on
 * the consent-change + storage events so a click on "Accept" lights everything up
 * without a reload. SSR-safe (starts false when a gate is required).
 */
export function useConsentGranted(required: boolean): boolean {
  const [granted, setGranted] = useState(!required);
  useEffect(() => {
    if (!required) {
      setGranted(true);
      return;
    }
    const check = () => setGranted(readConsent() === "accepted");
    check();
    window.addEventListener(CONSENT_EVENT, check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener(CONSENT_EVENT, check);
      window.removeEventListener("storage", check);
    };
  }, [required]);
  return granted;
}
