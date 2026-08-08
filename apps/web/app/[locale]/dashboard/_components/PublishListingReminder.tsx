"use client";

import { Link } from "@/i18n/navigation";
import { Rocket } from "lucide-react";

/**
 * Shown when the host has a listing but NONE is published yet — a passive,
 * persistent "your listing is still a draft" banner. Renders nothing once the
 * host has a live listing.
 *
 * NOTE: the first-load "Publish your listing to get started" MODAL was removed
 * (founder directive) — it popped over the setup wizard mid-flow (e.g. right
 * after adding banking) and interrupted the host before they could finish the
 * required steps. The banner alone communicates the draft state without blocking.
 */
export function PublishListingReminder({
  needsPublish,
  draft,
}: {
  needsPublish: boolean;
  draft: { id: string; name: string } | null;
}) {
  if (!needsPublish) return null;

  const publishHref = draft
    ? `/dashboard/properties/${draft.id}/edit`
    : "/dashboard/properties";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 lg:px-8">
      <Rocket className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        Your listing is still a <strong>draft</strong> — publish it before you
        can take bookings, share your link or use paid features.
      </span>
      <Link
        href={publishHref}
        className="inline-flex shrink-0 items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-amber-700"
      >
        Publish my listing
      </Link>
    </div>
  );
}
