"use client";

import { AlertTriangle, Check, Info, Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";

export type PublicBroadcast = {
  id: string;
  severity: string;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  banner_dismiss_mode: string;
};

const STORAGE_KEY = "wielo_public_broadcasts_dismissed";

// Severity → colour tokens (mirrors the app BroadcastBanner). Severity is
// purely visual; the dismiss mode drives whether/how it closes.
const SEVERITY_STYLES: Record<
  string,
  {
    container: string;
    icon: string;
    text: string;
    body: string;
    Icon: typeof Info;
  }
> = {
  critical: {
    container: "border-red-300 bg-red-50",
    icon: "text-red-700",
    text: "text-red-900",
    body: "text-red-900/90",
    Icon: AlertTriangle,
  },
  warning: {
    container: "border-amber-300 bg-amber-50",
    icon: "text-amber-700",
    text: "text-amber-900",
    body: "text-amber-900/90",
    Icon: Info,
  },
  info: {
    container: "border-blue-300 bg-blue-50",
    icon: "text-blue-700",
    text: "text-blue-900",
    body: "text-blue-900/90",
    Icon: Megaphone,
  },
};

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export function PublicBroadcastClient({
  broadcasts,
}: {
  broadcasts: PublicBroadcast[];
}) {
  // null = not yet read from storage. Rendering nothing until we know avoids a
  // hydration mismatch and a flash of an already-dismissed banner.
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDismissed(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setDismissed([]);
    }
  }, []);

  if (dismissed === null) return null;

  const visible = broadcasts.filter(
    (b) => b.banner_dismiss_mode === "persistent" || !dismissed.includes(b.id),
  );
  if (visible.length === 0) return null;

  function close(id: string) {
    const next = Array.from(new Set([...(dismissed ?? []), id]));
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — banner just reappears next load */
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-2 px-5 py-3 lg:px-8">
      {visible.map((b) => {
        const s = SEVERITY_STYLES[b.severity] ?? SEVERITY_STYLES.info;
        const { Icon } = s;
        return (
          <div
            key={b.id}
            role={b.severity === "critical" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-card border p-3 shadow-card ${s.container}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.icon}`} />
            <div className="flex-1">
              <div className={`font-display font-bold ${s.text}`}>
                {b.title}
              </div>
              <p className={`mt-0.5 whitespace-pre-wrap text-sm ${s.body}`}>
                {b.body}
              </p>
              {b.link_url ? (
                isExternal(b.link_url) ? (
                  <a
                    href={b.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-1 inline-block text-sm font-semibold underline ${s.text}`}
                  >
                    {b.link_label ?? "Read more"}
                  </a>
                ) : (
                  <a
                    href={b.link_url}
                    className={`mt-1 inline-block text-sm font-semibold underline ${s.text}`}
                  >
                    {b.link_label ?? "Read more"}
                  </a>
                )
              ) : null}
            </div>
            {b.banner_dismiss_mode === "acknowledge" ? (
              <button
                type="button"
                onClick={() => close(b.id)}
                className={`border-current/30 inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold ${s.text}`}
              >
                <Check className="h-3.5 w-3.5" />
                Got it
              </button>
            ) : b.banner_dismiss_mode === "dismissible" ? (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => close(b.id)}
                className={`shrink-0 rounded-md p-1 ${s.text} hover:bg-black/5`}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
