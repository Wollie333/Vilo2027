"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the getting-started checklist honest under client-side caching.
 *
 * `staleTimes.dynamic` lets the Router Cache reuse a dynamic page for a few
 * seconds, which makes revisiting sidebar items feel instant. The one place
 * that can't tolerate a stale render is the onboarding view: a host completes
 * a setup step on another page, navigates back to /dashboard, and must see the
 * unlocked dashboard — not a cached pre-completion checklist.
 *
 * Rendered ONLY in the onboarding branch of the dashboard, this refetches the
 * route the moment the (possibly cached) checklist mounts and whenever the tab
 * regains focus, so the checklist can never be served stale. It's a no-op once
 * setup is complete because the onboarding branch — and this component — stop
 * rendering.
 */
export function OnboardingFreshness() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  return null;
}
