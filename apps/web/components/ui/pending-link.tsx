"use client";

/**
 * A link into a HEAVY route (the page builder, the editors) that immediately
 * shows the labeled "what's happening" busy overlay on click, so the user gets
 * an explicit "Opening the editor…" message during the navigation latency — not
 * just a frozen screen. The overlay clears when the destination commits (the
 * route's loading.tsx skeleton then takes over), with a small minimum-visible
 * time so it never flashes on a warm/instant load.
 *
 *   <PendingLink
 *     href={editHref}
 *     busy={{ title: "Opening the editor", message: "Loading your page…" }}
 *     className="pill"
 *   >
 *     Edit page
 *   </PendingLink>
 *
 * For ordinary in-app links the global top-bar already gives feedback — reach
 * for PendingLink only where the destination is slow enough to warrant the
 * explanatory modal. See RULES.md → "Every action gives feedback".
 */

import * as React from "react";

import { useRouter } from "@/i18n/navigation";

import { busy, type BusyOptions } from "./busy-host";

// Keep the overlay up briefly even on fast navigations so it reads as a
// deliberate "loading" beat rather than a flicker.
const MIN_VISIBLE_MS = 550;

type AnchorProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
>;

export function PendingLink({
  href,
  busy: busyOpts,
  children,
  ...rest
}: {
  href: string;
  /** Title + message for the overlay (e.g. "Opening the editor"). */
  busy?: BusyOptions;
  children: React.ReactNode;
} & AnchorProps) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const idRef = React.useRef<number | null>(null);
  const shownRef = React.useRef(0);

  React.useEffect(() => {
    if (pending || idRef.current == null) return;
    const id = idRef.current;
    idRef.current = null;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownRef.current));
    const t = setTimeout(() => busy.hide(id), wait);
    return () => clearTimeout(t);
  }, [pending]);

  return (
    <a
      href={href}
      onClick={(e) => {
        // Let the browser handle new-tab / new-window intents.
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        idRef.current = busy.show(busyOpts ?? {});
        shownRef.current = Date.now();
        start(() => router.push(href));
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
