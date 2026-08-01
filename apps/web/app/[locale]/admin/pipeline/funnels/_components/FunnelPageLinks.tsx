"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

// Two URL rows for a funnel — the landing page and its thank-you page — each with
// an open-in-new-tab link and a copy-to-clipboard button. The absolute URL is
// resolved from the browser origin so copied links carry the real domain (the
// /go/* routes are locale-free, so origin + path is the true public URL).

type Row = { label: string; path: string };

export function FunnelPageLinks({ slug }: { slug: string }) {
  const rows: Row[] = [
    { label: "Landing page", path: `/go/${slug}` },
    { label: "Thank-you page", path: `/go/${slug}/thanks` },
  ];
  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <UrlRow key={r.path} label={r.label} path={r.path} />
      ))}
    </div>
  );
}

function UrlRow({ label, path }: Row) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const absolute = origin ? `${origin}${path}` : path;

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(absolute);
      ok = true;
    } catch {
      // Async Clipboard API can be unavailable (older browser / no permission).
      // Fall back to the legacy execCommand path via a temporary textarea.
      try {
        const ta = document.createElement("textarea");
        ta.value = absolute;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-light px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-brand-mute">
          {label}
        </div>
        <div className="truncate font-mono text-[12.5px] text-brand-ink">
          {path}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-2.5 text-[12px] font-semibold text-brand-secondary transition hover:bg-brand-light"
        title="Copy full URL"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-brand-primary" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </button>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-secondary px-2.5 text-[12px] font-semibold text-white transition hover:bg-brand-primary"
        title="Open in a new tab"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open
      </a>
    </div>
  );
}
