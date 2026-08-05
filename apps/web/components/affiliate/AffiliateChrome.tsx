"use client";

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";

// Decides the affiliate frame based on the current route. Inside a single
// competition (…/race/<slug>) the whole content area is that competition: the
// top-level affiliate tabs + header are hidden and replaced by a single link
// back to the affiliate dashboard. Everywhere else the normal chrome shows.
//
// A client component because only the browser knows the live pathname reliably
// across the localized routes (the x-pathname request header is not propagated
// once next-intl owns the response). `chrome` and `children` are server-rendered
// and passed through untouched.
export function AffiliateChrome({
  basePath,
  chrome,
  persistent,
  children,
}: {
  basePath: string;
  chrome: ReactNode;
  // Rendered top-right on EVERY page (including competition detail, where the
  // rest of the chrome is stripped) — e.g. the always-visible partner-code card.
  persistent?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isCompetitionDetail = pathname.startsWith(`${basePath}/race/`);

  const persistentBar = persistent ? (
    <div className="mb-3 flex justify-end">{persistent}</div>
  ) : null;

  if (isCompetitionDetail) {
    return (
      <div>
        {persistentBar}
        <Link
          href={basePath}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-mute transition-colors hover:text-brand-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to affiliate dashboard
        </Link>
        <div className="pt-4">{children}</div>
      </div>
    );
  }

  return (
    <>
      {persistentBar}
      {chrome}
      <div className="pt-6">{children}</div>
    </>
  );
}
