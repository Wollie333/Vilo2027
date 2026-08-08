"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Rocket } from "lucide-react";

/**
 * Passive "your listing is still a draft" banner, shown when the host has a
 * listing but none is published yet.
 *
 * Two founder rules:
 *  1. Not on the FIRST login — a brand-new host shouldn't be nagged while they're
 *     still going through first-time setup. We count distinct browser sessions
 *     (≈ logins) client-side: sessionStorage marks the current session, and a
 *     localStorage counter increments once per new session. The banner only
 *     appears from the SECOND session onward.
 *  2. The button routes into the finish-setup wizard (/dashboard/setup) so the
 *     host completes the required steps and publishes there — not the raw
 *     property editor.
 *
 * Renders nothing once the host has a live listing (needsPublish=false).
 */
export function PublishListingReminder({
  needsPublish,
  draft,
}: {
  needsPublish: boolean;
  draft: { id: string; name: string } | null;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!needsPublish) {
      setShow(false);
      return;
    }
    const SESSION_FLAG = "wielo-dash-session";
    const COUNT_KEY = "wielo-dash-logins";
    let count = Number(localStorage.getItem(COUNT_KEY) ?? "0");
    if (!sessionStorage.getItem(SESSION_FLAG)) {
      count += 1;
      localStorage.setItem(COUNT_KEY, String(count));
      sessionStorage.setItem(SESSION_FLAG, "1");
    }
    // Only from the second login onward.
    setShow(count >= 2);
  }, [needsPublish]);

  if (!needsPublish || !show) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 lg:px-8">
      <Rocket className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        {draft?.name ? (
          <>
            <strong>{draft.name}</strong> is still a draft
          </>
        ) : (
          <>
            Your listing is still a <strong>draft</strong>
          </>
        )}{" "}
        — finish setup and publish it before you can take bookings, share your
        link or use paid features.
      </span>
      <Link
        href="/dashboard/setup"
        className="inline-flex shrink-0 items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-amber-700"
      >
        Publish my listing
      </Link>
    </div>
  );
}
