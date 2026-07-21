"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for a crash that escapes every other boundary, including
 * one in the root layout. Next replaces the whole document here, so this file
 * must render its own <html>/<body>.
 *
 * Two jobs, in this order: TELL US, then show the visitor something that isn't a
 * stack trace. Until now neither happened — a crash rendered Next's default
 * error page and was recorded nowhere.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // keepalive so the report still goes out if the user immediately navigates
    // away from a page that just broke — which is exactly what people do.
    try {
      const body = JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.pathname + window.location.search,
      });
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Reporting must never add a second failure on top of the first.
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#F4FAF6",
          color: "#0E241A",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
            Something went wrong on our side
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#4A6156",
              margin: "0 0 20px",
            }}
          >
            We&apos;ve been told about it. Try again — and if it keeps
            happening, let us know and we&apos;ll sort it out.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: "#12A171",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: 999,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "#0E241A",
                background: "#fff",
                border: "1px solid #DCEAE0",
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
          {error.digest ? (
            <p style={{ marginTop: 18, fontSize: 12, color: "#7C9186" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
