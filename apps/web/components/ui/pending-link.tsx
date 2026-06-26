"use client";

/**
 * A link into a HEAVY route (the page builder, the editors) that immediately
 * shows the labeled "what's happening" busy overlay on click, so the user gets
 * an explicit "Opening the editor…" message during the navigation latency — not
 * just a frozen screen. The overlay is nav-scoped: the root <BusyHost> clears it
 * on the next route change (with a small min-visible beat so it never flashes),
 * then the destination's loading.tsx skeleton takes over. Crucially the hide is
 * NOT tied to this component's lifecycle — navigating unmounts it, so it must
 * not be the thing responsible for clearing the overlay.
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
        busy.showNav(busyOpts ?? {});
        router.push(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
