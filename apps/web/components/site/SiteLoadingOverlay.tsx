"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A theme-styled full-screen "working…" overlay for the public site. Shown while a
 * time-taking action runs (confirming a booking, fetching EFT details, handing off
 * to the checkout) so the guest always sees that something is happening rather than
 * a frozen button. Styled from `--site-*` tokens so it matches the active theme.
 *
 * The inline <style> only defines a keyframe (no `>` combinator), so it's
 * hydration-safe inside this client component.
 */
export function SiteLoadingOverlay({
  show,
  message,
  sub,
}: {
  show: boolean;
  message: string;
  sub?: string;
}) {
  // Portal to <body> so no themed ancestor (e.g. .wielo-safari's overflow:clip) can
  // crop the overlay. `mounted` keeps it client-only (createPortal needs document).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!show || !mounted) return null;
  return createPortal(
    <div
      role="status"
      aria-live="assertive"
      aria-busy="true"
      className="wielo-site-loading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(12, 9, 5, 0.55)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <style>{`@keyframes wielo-site-spin{to{transform:rotate(360deg)}}`}</style>
      <div
        style={{
          width: "min(360px, 100%)",
          textAlign: "center",
          background: "var(--site-surface, #fff)",
          color: "var(--site-ink, #1a1a1a)",
          border: "1px solid var(--site-line, #e6e6e6)",
          borderRadius: "var(--site-radius, 14px)",
          padding: "30px 32px",
          boxShadow: "0 36px 70px -28px rgba(0,0,0,0.6)",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "3px solid var(--site-line, #e6e6e6)",
            borderTopColor: "var(--site-accent, #0a7d4b)",
            animation: "wielo-site-spin 0.8s linear infinite",
          }}
        />
        <p style={{ margin: "16px 0 0", fontSize: 16, fontWeight: 700 }}>
          {message}
        </p>
        {sub ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "var(--site-mute, #6b7a72)",
            }}
          >
            {sub}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
