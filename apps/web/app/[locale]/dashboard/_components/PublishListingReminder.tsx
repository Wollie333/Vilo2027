"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Rocket, X } from "lucide-react";

/**
 * Shown when the host has a listing but NONE is published yet — a proactive
 * "publish your listing first" nudge (founder directive: a real modal, not a
 * silent redirect). Behaviour: a dismissible modal pops on first load this
 * session; after dismissal a persistent banner stays until a listing goes live.
 * Renders nothing once the host has a live listing.
 */
export function PublishListingReminder({
  needsPublish,
  draft,
}: {
  needsPublish: boolean;
  draft: { id: string; name: string } | null;
}) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!needsPublish) return;
    // Pop the modal once per browser session so it emphasises on arrival without
    // nagging on every navigation; the banner below persists regardless.
    if (sessionStorage.getItem("wielo-publish-nudge-dismissed") !== "1") {
      setShowModal(true);
    }
  }, [needsPublish]);

  if (!needsPublish) return null;

  const publishHref = draft
    ? `/dashboard/properties/${draft.id}/edit`
    : "/dashboard/properties";

  function dismissModal() {
    sessionStorage.setItem("wielo-publish-nudge-dismissed", "1");
    setShowModal(false);
  }

  return (
    <>
      {/* Persistent banner — stays until a listing is published. */}
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

      {/* First-load modal. */}
      {showModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-nudge-title"
          onClick={dismissModal}
        >
          <div
            className="relative w-full max-w-md rounded-card border border-brand-line bg-white p-6 shadow-peek"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismissModal}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Rocket className="h-6 w-6" />
            </div>
            <h2
              id="publish-nudge-title"
              className="font-display text-lg font-bold text-brand-ink"
            >
              Publish your listing to get started
            </h2>
            <p className="mt-1.5 text-sm text-brand-mute">
              {draft?.name ? (
                <>
                  <span className="font-medium text-brand-ink">
                    {draft.name}
                  </span>{" "}
                  is still a draft.{" "}
                </>
              ) : (
                "Your listing is still a draft. "
              )}
              You need to publish it before guests can find and book it, and
              before you can share your direct booking link.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={dismissModal}
                className="rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-light"
              >
                Maybe later
              </button>
              <Link
                href={publishHref}
                onClick={dismissModal}
                className="inline-flex items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
              >
                Finish &amp; publish
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
