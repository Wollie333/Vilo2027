"use client";

import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ackBroadcastAction } from "./broadcast-ack-action";

type Props = {
  broadcastId: string;
  href: string;
  className?: string;
  external?: boolean;
  children: React.ReactNode;
};

// Wraps a broadcast link with click-tracking. Fires the ack action
// (mode='click') then navigates. For external links the action runs
// asynchronously while the new tab opens — no navigation interception.

export function BroadcastLink({
  broadcastId,
  href,
  className,
  external,
  children,
}: Props) {
  const router = useRouter();
  const [, start] = useTransition();

  function recordClick() {
    start(async () => {
      await ackBroadcastAction({ broadcastId, mode: "click" });
    });
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={recordClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        recordClick();
        router.push(href);
      }}
    >
      {children}
    </Link>
  );
}

function isExternalUrl(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export { isExternalUrl };
