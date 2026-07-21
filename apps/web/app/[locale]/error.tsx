"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * global-error.tsx only catches a crash in the ROOT LAYOUT — the rare case. The
 * common one is a page or component throwing, which lands here. Without this
 * file that error rendered Next's default page and was reported nowhere, so most
 * real failures would have gone uncounted even with capture switched on.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          url: window.location.pathname + window.location.search,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Reporting must never add a second failure on top of the first.
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="font-display text-[22px] font-bold text-brand-ink">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-brand-mute">
        We&apos;ve been told about it. Try again — and if it keeps happening,
        let us know and we&apos;ll sort it out.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-pill border border-brand-line bg-white px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:border-brand-primary/40"
        >
          Go home
        </a>
      </div>
      {error.digest ? (
        <p className="mt-5 text-[12px] text-brand-mute">
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
